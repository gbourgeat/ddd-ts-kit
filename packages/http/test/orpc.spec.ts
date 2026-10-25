import { Readable } from 'node:stream';
import { createORPCClient, isDefinedError, ORPCError, safe } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { type ContractRouterClient, oc, type } from '@orpc/contract';
import { RPCHandler } from '@orpc/server/fetch';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { expectVersion } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import {
  createErrorMapper,
  defineRoute,
  IfMatch,
  type Problem,
  Representations,
  type Route,
  streamSchemaOf,
  UnauthorizedError,
} from '../src';
import type { ExecuteOptions } from '../src/pipeline/execute-options';
import { orpcRouter } from '../src/orpc';
import { catalogRoutes } from './support/catalog';
import { KNOWN_ORDER, orderRoutes, SHIPPED_ORDER } from './support/orders';

interface Order {
  readonly id: string;
  readonly customerId: string;
  readonly lines: number;
}

/** What `ddd-ts-kit sdk` writes for the order routes when `sdk.rpc` is `orpc`. */
const contract = {
  placeOrder: oc
    .errors({
      CONFLICT: { status: 409, data: type<Problem>() },
      VALIDATION_FAILED: { status: 422, data: type<Problem>() },
    })
    .input(type<{ body: { customerId: string; items: { sku: string; quantity: number }[] } }>())
    .output(type<Order>()),
  getOrder: oc
    .errors({
      NOT_FOUND: { status: 404, data: type<Problem>() },
      ORDER_ALREADY_SHIPPED: { status: 422, data: type<Problem>() },
      CONFLICT: { status: 409, data: type<Problem>() },
      VALIDATION_FAILED: { status: 422, data: type<Problem>() },
    })
    .input(type<{ path: { orderId: string }; query?: { expand?: 'lines' } }>())
    .output(type<Order>()),
  cancelOrder: oc.input(type<{ path: { orderId: string } }>()).output(type<undefined>()),
  whoAmI: oc.input(type<undefined>()).output(type<{ principal: unknown }>()),
};

const PREFIX = '/rpc';

function clientOf(
  routes: readonly Route[],
  options: ExecuteOptions = {},
  headers: Record<string, string> = {},
): ContractRouterClient<typeof contract> {
  const handler = new RPCHandler(orpcRouter(routes, options));

  const link = new RPCLink({
    url: `http://api.test${PREFIX}`,
    headers,
    fetch: async (request) => {
      const sent = request instanceof Request ? request : new Request(request);

      const { matched, response } = await handler.handle(sent, {
        prefix: PREFIX,
        context: { headers: Object.fromEntries(sent.headers) },
      });

      return matched ? response : new Response(null, { status: 404 });
    },
  });

  return createORPCClient(link);
}

/** A client of procedures the contract above does not list: what a test of one route calls. */
function untypedClientOf(
  routes: readonly Route[],
  options: ExecuteOptions = {},
): Record<string, (input?: unknown) => Promise<unknown>> {
  return clientOf(routes, options) as unknown as Record<string, (input?: unknown) => Promise<unknown>>;
}

describe('a procedure of orpcRouter', () => {
  it('is named after the operationId of its route: one per operation of the contract', () => {
    expect(Object.keys(orpcRouter(orderRoutes)).sort()).toEqual(Object.keys(contract).sort());
  });

  it('runs its route through the pipeline and returns the body of the answer', async () => {
    const client = clientOf(orderRoutes);

    expect(await client.getOrder({ path: { orderId: KNOWN_ORDER }, query: { expand: 'lines' } })).toEqual({
      id: KNOWN_ORDER,
      customerId: 'c-1',
      lines: 2,
    });
  });

  it('returns nothing for an answer without a body', async () => {
    const client = clientOf(orderRoutes, { resolvePrincipal: () => 'u-1' });

    expect(await client.cancelOrder({ path: { orderId: KNOWN_ORDER } })).toBeUndefined();
  });

  it('throws a refusal declared by the contract as a defined error, its problem as data', async () => {
    const client = clientOf(orderRoutes);

    const [error] = await safe(client.getOrder({ path: { orderId: SHIPPED_ORDER } }));

    expect(isDefinedError(error)).toBe(true);

    expect(error).toMatchObject({
      code: 'ORDER_ALREADY_SHIPPED',
      status: 422,
      message: 'The order has already been shipped.',
      data: { code: 'ORDER_ALREADY_SHIPPED', status: 422, type: 'urn:problem:order-already-shipped' },
    });
  });

  it('refuses an input its schema refuses with VALIDATION_FAILED and the issues', async () => {
    const client = clientOf(orderRoutes, { resolvePrincipal: () => 'u-1' });

    const [error] = await safe(client.placeOrder({ body: { customerId: '', items: [] } }));

    expect(isDefinedError(error)).toBe(true);
    expect(error).toMatchObject({ code: 'VALIDATION_FAILED', status: 422, data: { issues: expect.any(Array) } });
  });

  it('throws a refusal the contract does not declare as an error that is not defined, with its code', async () => {
    const client = clientOf(orderRoutes, {
      resolvePrincipal: () => {
        throw new UnauthorizedError('No credential.');
      },
    });

    const [error] = await safe(client.whoAmI());

    expect(isDefinedError(error)).toBe(false);
    expect(error).toMatchObject({ code: 'UNAUTHORIZED', status: 401, data: { code: 'UNAUTHORIZED' } });
  });

  it('declares the status the error mapper of the application gives a code', async () => {
    const client = clientOf(orderRoutes, { errorMapper: createErrorMapper({ ORDER_ALREADY_SHIPPED: 409 }) });

    const [error] = await safe(client.getOrder({ path: { orderId: SHIPPED_ORDER } }));

    expect(isDefinedError(error)).toBe(true);
    expect(error).toMatchObject({ code: 'ORDER_ALREADY_SHIPPED', status: 409 });
  });

  it('hides the message of an unexpected failure, as the HTTP routes do', async () => {
    const client = clientOf(orderRoutes);

    const [error] = await safe(client.getOrder({ path: { orderId: '22222222-2222-4222-8222-222222222222' } }));

    expect(error).toMatchObject({ code: 'INTERNAL_ERROR', status: 500 });
    expect(JSON.stringify(error)).not.toContain('hunter2');
  });

  it('authenticates the caller from the headers of the RPC request', async () => {
    const client = clientOf(
      orderRoutes,
      { resolvePrincipal: (raw) => (raw as { headers: Record<string, string> }).headers['authorization'] },
      { authorization: 'Bearer t-1' },
    );

    expect(await client.whoAmI()).toEqual({ principal: 'Bearer t-1' });
  });

  it('reads the principal from the raw request the server hands over, when it hands one', async () => {
    const handler = new RPCHandler(orpcRouter(orderRoutes, { resolvePrincipal: (raw) => raw }));

    const { response } = await handler.handle(new Request('http://api.test/rpc/whoAmI', { method: 'POST' }), {
      prefix: PREFIX,
      context: { headers: {}, raw: 'the framework request' },
    });

    expect(await response?.json()).toEqual({ json: { principal: 'the framework request' } });
  });
});

describe('the headers of a call', () => {
  const echo = defineRoute(
    {
      method: 'PUT',
      path: '/calendars/:calendarId/name',
      operationId: 'renameCalendar',
      summary: 'Rename a calendar',
      request: { headers: zodSchema(z.object({ 'x-reason': z.string() })) },
      responses: {
        200: { description: 'Renamed.', body: zodSchema(z.object({ on: z.number(), reason: z.string() })) },
      },
      security: false,
      ifMatch: IfMatch.required,
    },
    ({ headers, context }) => {
      expectVersion({ id: 'calendar-1', version: 7 }, context.expectedVersion);

      return { status: 200, body: { on: context.expectedVersion ?? 0, reason: headers['x-reason'] } };
    },
  );

  it('are those of its input over those of the RPC request, If-Match among them', async () => {
    const client = untypedClientOf([echo]);

    expect(await client['renameCalendar']?.({ header: { 'X-Reason': 'typo', 'If-Match': '"7"' } })).toEqual({
      on: 7,
      reason: 'typo',
    });
  });

  it('keep the precondition of the route: a write without If-Match is refused', async () => {
    const client = untypedClientOf([echo]);

    await expect(client['renameCalendar']?.({ header: { 'X-Reason': 'typo' } })).rejects.toMatchObject({
      code: 'PRECONDITION_REQUIRED',
      status: 428,
    });
  });
});

describe('what only HTTP carries', () => {
  it('leaves out of the router a route that receives a file or a raw body', () => {
    const [placeOrder] = orderRoutes;
    const upload = { ...placeOrder, operationId: 'attach', path: '/attach', upload: { field: 'file', maxBytes: 8 } };
    const raw = { ...placeOrder, operationId: 'receive', path: '/receive', rawBody: true };
    const router = orpcRouter([...orderRoutes, upload, raw] as Route[]);

    expect(Object.keys(router).sort()).toEqual(['cancelOrder', 'getOrder', 'placeOrder', 'whoAmI']);
  });

  it('answers JSON whatever the representations, and whatever the RPC request accepts', async () => {
    const client = untypedClientOf(catalogRoutes, { representations: Representations.standard() });

    expect(await client['searchProducts']?.({})).toEqual(expect.any(Object));
  });

  it.each([
    ['written by a representation', { representations: Representations.standard() }],
    ['handed over as it is', {}],
  ])('refuses a streamed list %s with 406, and leaves no read of it open', async (_how, options: ExecuteOptions) => {
    const reads = { opened: 0, closed: 0 };

    async function* rows(): AsyncGenerator<{ id: number }> {
      reads.opened += 1;

      try {
        yield { id: 1 };
        yield { id: 2 };
      } finally {
        reads.closed += 1;
      }
    }

    const streamed = defineRoute(
      {
        method: 'GET',
        path: '/rows',
        operationId: 'exportRows',
        summary: 'Export the rows',
        responses: { 200: { description: 'The rows.', body: streamSchemaOf(zodSchema(z.object({ id: z.number() }))) } },
        security: false,
      },
      () => ({ status: 200, body: rows() }),
    );

    await expect(untypedClientOf([streamed], options)['exportRows']?.()).rejects.toMatchObject({
      code: 'NOT_ACCEPTABLE',
      status: 406,
      data: { code: 'NOT_ACCEPTABLE', status: 406, requestId: expect.any(String) },
    });

    expect(reads.closed).toBe(reads.opened);
  });

  it('refuses a file with 406, and closes it', async () => {
    const file = Readable.from(['%PDF']);

    const download = defineRoute(
      {
        method: 'GET',
        path: '/report',
        operationId: 'downloadReport',
        summary: 'Download the report',
        responses: { 200: { description: 'The report.', body: zodSchema(z.unknown()) } },
        security: false,
      },
      () => ({ status: 200, body: file, headers: { 'content-type': 'application/pdf' } }),
    );

    await expect(untypedClientOf([download])['downloadReport']?.()).rejects.toBeInstanceOf(ORPCError);
    expect(file.destroyed).toBe(true);
  });

  it('returns a binary body as a Blob of its media type', async () => {
    const image = defineRoute(
      {
        method: 'GET',
        path: '/logo',
        operationId: 'readLogo',
        summary: 'Read the logo',
        responses: { 200: { description: 'The logo.', body: zodSchema(z.unknown()) } },
        security: false,
      },
      () => ({ status: 200, body: new Uint8Array([137, 80]), headers: { 'content-type': 'image/png' } }),
    );

    const logo = await untypedClientOf([image])['readLogo']?.();

    expect(logo).toBeInstanceOf(Blob);
    expect(new Uint8Array(await (logo as Blob).arrayBuffer())).toEqual(new Uint8Array([137, 80]));
  });
});

describe('a refusal the route answers without a problem document', () => {
  it('keeps its status and its body, under the code HTTP_<status>', async () => {
    const gone = defineRoute(
      {
        method: 'GET',
        path: '/legacy',
        operationId: 'readLegacy',
        summary: 'Read what is gone',
        responses: { 410: { description: 'Gone.', body: zodSchema(z.object({ since: z.string() })) } },
        security: false,
      },
      () => ({ status: 410, body: { since: '2026-01-01' } }),
    );

    await expect(untypedClientOf([gone])['readLegacy']?.()).rejects.toMatchObject({
      code: 'HTTP_410',
      status: 410,
      data: { since: '2026-01-01' },
    });
  });
});

describe('the routes of orpcRouter', () => {
  it('are refused when two share an operationId: one procedure would hide the other', () => {
    expect(() => orpcRouter([...orderRoutes, { ...orderRoutes[0], path: '/other' } as Route])).toThrow(
      /Duplicate operationId "placeOrder"/,
    );
  });
});

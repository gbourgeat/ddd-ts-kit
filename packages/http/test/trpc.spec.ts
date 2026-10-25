import { describe, expect, it } from 'vitest';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { z } from 'zod';
import { expectVersion } from '@ddd-ts-kit/kernel';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { createErrorMapper, defineRoute, IfMatch, type Route, UnauthorizedError } from '../src';
import { trpcRouter } from '../src/trpc';
import { orderRoutes, KNOWN_ORDER, SHIPPED_ORDER } from './support/orders';
import { clientOf, ENDPOINT, refusalOf, untypedClientOf } from './support/trpc-client';

describe('a procedure of trpcRouter', () => {
  it('is named after the operationId of its route: a query for a GET, a mutation for the other methods', () => {
    const procedures = trpcRouter(orderRoutes)._def.procedures;

    expect(Object.fromEntries(Object.entries(procedures).map(([name, { _def }]) => [name, _def.type]))).toEqual({
      placeOrder: 'mutation',
      getOrder: 'query',
      cancelOrder: 'mutation',
      whoAmI: 'query',
    });
  });

  it('runs its route through the pipeline and returns the body of the answer', async () => {
    const client = clientOf(orderRoutes);

    expect(await client.getOrder.query({ path: { orderId: KNOWN_ORDER }, query: { expand: 'lines' } })).toEqual({
      id: KNOWN_ORDER,
      customerId: 'c-1',
      lines: 2,
    });
  });

  it('returns nothing for an answer without a body', async () => {
    const client = clientOf(orderRoutes, { resolvePrincipal: () => 'u-1' });

    expect(await client.cancelOrder.mutate({ path: { orderId: KNOWN_ORDER } })).toBeUndefined();
  });

  it('throws a refusal as the tRPC code of its status, the problem of the route in its data', async () => {
    const error = await refusalOf(clientOf(orderRoutes).getOrder.query({ path: { orderId: SHIPPED_ORDER } }));

    expect(error.message).toBe('The order has already been shipped.');

    expect(error.data).toMatchObject({
      code: 'UNPROCESSABLE_CONTENT',
      httpStatus: 422,
      path: 'getOrder',
      problem: { code: 'ORDER_ALREADY_SHIPPED', status: 422, type: 'urn:problem:order-already-shipped' },
    });

    expect(error.data).not.toHaveProperty('stack');
  });

  it('refuses an input its schema refuses with VALIDATION_FAILED and the issues', async () => {
    const client = clientOf(orderRoutes, { resolvePrincipal: () => 'u-1' });

    const error = await refusalOf(client.placeOrder.mutate({ body: { customerId: '', items: [] } }));

    expect(error.data?.problem).toMatchObject({ code: 'VALIDATION_FAILED', issues: expect.any(Array) });
  });

  it('refuses an anonymous caller as UNAUTHORIZED, with the code of the kit in its problem', async () => {
    const client = clientOf(orderRoutes, {
      resolvePrincipal: () => {
        throw new UnauthorizedError('No credential.');
      },
    });

    const error = await refusalOf(client.whoAmI.query());

    expect(error.data).toMatchObject({ code: 'UNAUTHORIZED', httpStatus: 401, problem: { code: 'UNAUTHORIZED' } });
  });

  it('gives a refusal the status the error mapper of the application gives its code', async () => {
    const client = clientOf(orderRoutes, { errorMapper: createErrorMapper({ ORDER_ALREADY_SHIPPED: 409 }) });

    const error = await refusalOf(client.getOrder.query({ path: { orderId: SHIPPED_ORDER } }));

    expect(error.data).toMatchObject({ code: 'CONFLICT', httpStatus: 409, problem: { status: 409 } });
  });

  it('hides the message of an unexpected failure, as the HTTP routes do', async () => {
    const client = clientOf(orderRoutes);

    const error = await refusalOf(client.getOrder.query({ path: { orderId: '22222222-2222-4222-8222-222222222222' } }));

    expect(error.data).toMatchObject({ code: 'INTERNAL_SERVER_ERROR', problem: { code: 'INTERNAL_ERROR' } });
    expect(JSON.stringify(error.shape)).not.toContain('hunter2');
  });

  it('authenticates the caller from the headers of the RPC request', async () => {
    const client = clientOf(
      orderRoutes,
      { resolvePrincipal: (raw) => (raw as { headers: Record<string, string> }).headers['authorization'] },
      { authorization: 'Bearer t-1' },
    );

    expect(await client.whoAmI.query()).toEqual({ principal: 'Bearer t-1' });
  });

  it('reads the principal from the raw request the server hands over, when it hands one', async () => {
    const response = await fetchRequestHandler({
      endpoint: ENDPOINT,
      req: new Request('http://api.test/trpc/whoAmI'),
      router: trpcRouter(orderRoutes, { resolvePrincipal: (raw) => raw }),
      createContext: () => ({ headers: {}, raw: 'the framework request' }),
    });

    expect(await response.json()).toEqual({ result: { data: { principal: 'the framework request' } } });
  });

  it('leaves an error of tRPC itself without a problem: an unknown procedure is NOT_FOUND', async () => {
    const error = await refusalOf(untypedClientOf(orderRoutes)['noSuchProcedure']?.query() ?? Promise.resolve());

    expect(error.data).toMatchObject({ code: 'NOT_FOUND', httpStatus: 404, problem: null });
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

  const mutationsOf = (routes: readonly Route[]) =>
    untypedClientOf(routes) as unknown as Record<string, { mutate: (input: unknown) => Promise<unknown> }>;

  it('are those of its input over those of the RPC request, If-Match among them', async () => {
    const rename = mutationsOf([echo])['renameCalendar'];

    expect(await rename?.mutate({ header: { 'X-Reason': 'typo', 'If-Match': '"7"' } })).toEqual({
      on: 7,
      reason: 'typo',
    });
  });

  it('keep the precondition of the route: a write without If-Match is refused', async () => {
    const rename = mutationsOf([echo])['renameCalendar'];

    const error = await refusalOf(rename?.mutate({ header: { 'X-Reason': 'typo' } }) ?? Promise.resolve());

    expect(error.data).toMatchObject({ code: 'PRECONDITION_REQUIRED', problem: { code: 'PRECONDITION_REQUIRED' } });
  });
});

describe('the routes of trpcRouter', () => {
  it('are refused when two share an operationId: one procedure would hide the other', () => {
    expect(() => trpcRouter([...orderRoutes, { ...orderRoutes[0], path: '/other' } as Route])).toThrow(
      /Duplicate operationId "placeOrder"/,
    );
  });
});

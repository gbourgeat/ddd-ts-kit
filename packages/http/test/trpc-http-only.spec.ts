import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineRoute, Representations, type Route, streamSchemaOf } from '../src';
import type { ExecuteOptions } from '../src/pipeline/execute-options';
import { trpcRouter } from '../src/trpc';
import { catalogRoutes } from './support/catalog';
import { orderRoutes } from './support/orders';
import { refusalOf, untypedClientOf } from './support/trpc-client';

describe('what only HTTP carries', () => {
  it('leaves out of the router a route that receives a file or a raw body', () => {
    const [placeOrder] = orderRoutes;
    const upload = { ...placeOrder, operationId: 'attach', path: '/attach', upload: { field: 'file', maxBytes: 8 } };
    const raw = { ...placeOrder, operationId: 'receive', path: '/receive', rawBody: true };
    const router = trpcRouter([...orderRoutes, upload, raw] as Route[]);

    expect(Object.keys(router._def.procedures).sort()).toEqual(['cancelOrder', 'getOrder', 'placeOrder', 'whoAmI']);
  });

  it('answers JSON whatever the representations, and whatever the RPC request accepts', async () => {
    const client = untypedClientOf(catalogRoutes, { representations: Representations.standard() });

    expect(await client['searchProducts']?.query({})).toEqual(expect.any(Object));
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

    const error = await refusalOf(untypedClientOf([streamed], options)['exportRows']?.query() ?? Promise.resolve());

    expect(error.data?.problem).toMatchObject({ code: 'NOT_ACCEPTABLE', status: 406 });
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

    const error = await refusalOf(untypedClientOf([download])['downloadReport']?.query() ?? Promise.resolve());

    expect(error.data?.problem).toMatchObject({ code: 'NOT_ACCEPTABLE' });
    expect(file.destroyed).toBe(true);
  });

  it('refuses a binary body with 406: tRPC answers JSON only', async () => {
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

    const error = await refusalOf(untypedClientOf([image])['readLogo']?.query() ?? Promise.resolve());

    expect(error.message).toBe('This operation answers a binary body, which only its HTTP route carries.');
    expect(error.data?.problem).toMatchObject({ code: 'NOT_ACCEPTABLE', status: 406 });
  });
});

describe('a refusal the route answers without a problem document', () => {
  it('keeps the tRPC code nearest its status, and no problem', async () => {
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

    const error = await refusalOf(untypedClientOf([gone])['readLegacy']?.query() ?? Promise.resolve());

    expect(error.message).toBe('HTTP_410');
    expect(error.data).toMatchObject({ code: 'BAD_REQUEST', problem: null });
  });

  it('is a server fault when its status is one, and tRPC knows no code for it', async () => {
    const down = defineRoute(
      {
        method: 'GET',
        path: '/down',
        operationId: 'readDown',
        summary: 'Read what is down',
        responses: { 507: { description: 'Full.', body: zodSchema(z.object({ free: z.number() })) } },
        security: false,
      },
      () => ({ status: 507, body: { free: 0 } }),
    );

    const error = await refusalOf(untypedClientOf([down])['readDown']?.query() ?? Promise.resolve());

    expect(error.data).toMatchObject({ code: 'INTERNAL_SERVER_ERROR', problem: null });
  });
});

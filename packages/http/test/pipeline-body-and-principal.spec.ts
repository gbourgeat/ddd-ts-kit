import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zodSchema } from '@ddd-ts-kit/validation/zod';
import { defineRoute, executeRoute, serializeBody } from '../src/index.js';

describe('serializeBody', () => {
  it('writes nothing when there is no body', () => {
    expect(serializeBody({ status: 204, headers: {} })).toBeUndefined();
  });

  it('writes JSON by default, strings included', () => {
    const headers = { 'content-type': 'application/json; charset=utf-8' };

    expect(serializeBody({ status: 200, headers, body: { a: 1 } })).toBe('{"a":1}');
    expect(serializeBody({ status: 200, headers, body: 'text' })).toBe('"text"');
  });

  it('writes a string as is under a content type chosen by the handler', () => {
    expect(serializeBody({ status: 200, headers: { 'content-type': 'text/csv' }, body: 'a;b' })).toBe('a;b');
  });

  it('writes bytes as is', () => {
    const bytes = new Uint8Array([1, 2, 3]);

    expect(serializeBody({ status: 200, headers: {}, body: bytes })).toBe(bytes);
  });
});

describe('withPrincipal', () => {
  it('runs the handler inside the scope opened for the resolved principal', async () => {
    const scope = new AsyncLocalStorage<unknown>();
    const request = { params: {}, query: {}, headers: {}, body: undefined, raw: undefined };

    const route = defineRoute(
      {
        method: 'GET',
        path: '/me',
        operationId: 'whoAmI',
        summary: 'Who am I',
        security: ['bearer'],
        responses: {
          200: { description: 'The caller.', body: zodSchema(z.object({ id: z.string() }), { io: 'output' }) },
        },
      },
      async () => ({ status: 200, body: { id: String(scope.getStore()) } }),
    );

    const response = await executeRoute(route, request, {
      resolvePrincipal: () => 'ada',
      withPrincipal: (principal, work) => scope.run(principal, work),
    });

    expect(response.body).toEqual({ id: 'ada' });
  });
});

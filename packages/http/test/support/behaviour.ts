import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DuplicateRouteError,
  UnauthorizedError,
  createErrorMapper,
  type ErrorContext,
  type ExecuteOptions,
  type Route,
} from '../../src/index.js';
import {
  BROKEN_ORDER,
  KNOWN_ORDER,
  SECRET,
  SHIPPED_ORDER,
  getOrder,
  orderRoutes,
  placeOrder,
} from './orders.js';

interface ProblemBody {
  readonly issues: readonly { readonly path: string }[];
}

const issuePaths = async (response: Response): Promise<string[]> =>
  ((await response.json()) as ProblemBody).issues.map((issue) => issue.path).sort();

export interface RunningServer {
  readonly url: string;
  close(): Promise<void>;
}

export type StartServer = (
  routes: readonly Route[],
  options: ExecuteOptions,
) => Promise<RunningServer>;

/** How each adapter reads the test credential out of its own request object. */
export type ReadAuthorization = (raw: unknown) => string | undefined;

/** The one suite every adapter must pass: the behaviour belongs to the pipeline, not the framework. */
export function describeAdapter(
  name: string,
  start: StartServer,
  readAuthorization: ReadAuthorization,
): void {
  describe(`routes mounted on ${name}`, () => {
    let server: RunningServer;
    const reported: { error: unknown; context: ErrorContext }[] = [];

    beforeAll(async () => {
      server = await start(orderRoutes, {
        errorMapper: createErrorMapper({ ORDER_ALREADY_SHIPPED: 410 }),
        validateResponses: true,
        onError: (error, context) => reported.push({ error, context }),
        resolvePrincipal: (raw) => {
          const authorization = readAuthorization(raw);
          if (authorization === 'Bearer expired') {
            throw new UnauthorizedError('The token has expired.');
          }
          return authorization === undefined ? undefined : { subject: authorization };
        },
      });
    });

    afterAll(async () => {
      await server.close();
    });

    const call = (path: string, init?: RequestInit): Promise<Response> =>
      fetch(`${server.url}${path}`, init);
    const post = (body: unknown): Promise<Response> =>
      call('/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    it('answers the declared status and body from typed params and body', async () => {
      const created = await post({ customerId: 'c-1', items: [{ sku: 'A-1', quantity: 2 }] });
      expect(created.status).toBe(201);
      expect(created.headers.get('content-type')).toBe('application/json; charset=utf-8');
      expect(created.headers.get('location')).toBe(`/orders/${KNOWN_ORDER}`);
      expect(await created.json()).toEqual({ id: KNOWN_ORDER, customerId: 'c-1', lines: 1 });

      const read = await call(`/orders/${KNOWN_ORDER}?expand=lines`);
      expect(read.status).toBe(200);
      expect(await read.json()).toEqual({ id: KNOWN_ORDER, customerId: 'c-1', lines: 2 });
    });

    it('answers without a body when the route declares none', async () => {
      const response = await call(`/orders/${KNOWN_ORDER}`, { method: 'DELETE' });
      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
    });

    it('keeps a well-formed incoming request id and generates one otherwise', async () => {
      const kept = await call(`/orders/${KNOWN_ORDER}`, { headers: { 'x-request-id': 'req-42' } });
      expect(kept.headers.get('x-request-id')).toBe('req-42');
      const generated = await post({ customerId: 'c-1', items: [{ sku: 'A-1', quantity: 1 }] });
      expect(generated.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
      expect(generated.headers.get('x-seen-request')).toBe(generated.headers.get('x-request-id'));
    });

    it('answers 422 with the issues when the body is not valid', async () => {
      const response = await post({ customerId: '', items: [{ sku: 'A-1', quantity: 0 }] });
      expect(response.status).toBe(422);
      expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      const text = await response.clone().text();
      expect(JSON.parse(text)).toMatchObject({
        type: 'urn:problem:validation-failed',
        title: 'Unprocessable Content',
        status: 422,
        code: 'VALIDATION_FAILED',
        detail: 'The request is not valid.',
        requestId: response.headers.get('x-request-id'),
      });
      expect(await issuePaths(response)).toEqual(['body.customerId', 'body.items.0.quantity']);
    });

    it('answers 422 when a path or query parameter is not valid', async () => {
      const response = await call('/orders/not-a-uuid?expand=everything');
      expect(response.status).toBe(422);
      expect(await issuePaths(response)).toEqual(['params.orderId', 'query.expand']);
    });

    it('answers a domain error under its mapped status as a problem', async () => {
      const missing = await call('/orders/33333333-3333-4333-8333-333333333333');
      expect(missing.status).toBe(404);
      expect(missing.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      expect(await missing.json()).toMatchObject({
        type: 'urn:problem:not-found',
        title: 'Not Found',
        status: 404,
        code: 'NOT_FOUND',
        detail: 'Order 33333333-3333-4333-8333-333333333333 does not exist.',
      });

      const shipped = await call(`/orders/${SHIPPED_ORDER}`);
      expect(shipped.status).toBe(410);
      expect(await shipped.json()).toMatchObject({ code: 'ORDER_ALREADY_SHIPPED', title: 'Gone' });

      const conflict = await call(`/orders/${SHIPPED_ORDER}`, { method: 'DELETE' });
      expect(conflict.status).toBe(409);
      expect(await conflict.json()).toMatchObject({ code: 'CONFLICT' });
    });

    it('answers 500 without leaking the message of an unexpected error', async () => {
      reported.length = 0;
      const response = await call(`/orders/${BROKEN_ORDER}`);
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).not.toContain('hunter2');
      expect(JSON.parse(text)).toEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        code: 'INTERNAL_ERROR',
        requestId: response.headers.get('x-request-id'),
      });
      // The message stays available to the logging hook, which is where it belongs.
      expect(reported).toHaveLength(1);
      expect(reported[0]?.error).toMatchObject({ message: SECRET });
      expect(reported[0]?.context).toMatchObject({ operationId: 'getOrder', method: 'GET' });
    });

    it('hands the resolved principal to the handler and maps a refusal', async () => {
      const known = await call('/me', { headers: { authorization: 'Bearer alice' } });
      expect(await known.json()).toEqual({ principal: { subject: 'Bearer alice' } });

      const refused = await call('/me', { headers: { authorization: 'Bearer expired' } });
      expect(refused.status).toBe(401);
      expect(await refused.json()).toMatchObject({ code: 'UNAUTHORIZED', title: 'Unauthorized' });
    });

    it('refuses to mount two routes sharing an operationId', async () => {
      const clash: Route = { ...getOrder, path: '/other/:orderId' };
      await expect(start([getOrder, clash], {})).rejects.toBeInstanceOf(DuplicateRouteError);
    });

    it('refuses to mount two routes sharing a method and path', async () => {
      const clash: Route = { ...placeOrder, operationId: 'placeOrderAgain' };
      await expect(start([placeOrder, clash], {})).rejects.toThrow(/POST \/orders/);
    });
  });
}

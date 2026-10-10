import { describe, expect, it } from 'vitest';
import type { AdapterClient } from './adapter-client.js';
import { BROKEN_ORDER, SECRET, SHIPPED_ORDER } from './orders.js';

interface ProblemBody {
  readonly issues: readonly { readonly path: string }[];
}

const issuePaths = async (response: Response): Promise<string[]> =>
  ((await response.json()) as ProblemBody).issues.map((issue) => issue.path).sort();

export function answersProblems({ call, post, reported }: AdapterClient): void {
  describe('problems and principal', () => {
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
  });
}

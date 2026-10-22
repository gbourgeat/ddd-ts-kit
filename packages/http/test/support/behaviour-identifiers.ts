import { describe, expect, it } from 'vitest';
import type { AdapterClient } from './adapter-client';
import { KNOWN_ORDER } from './orders';
import { executionScope } from './read-execution';

export function carriesIdentifiers({ call, post }: AdapterClient): void {
  describe('identifiers and execution scope', () => {
    it('keeps a well-formed incoming request id and generates one otherwise', async () => {
      const kept = await call(`/orders/${KNOWN_ORDER}`, { headers: { 'x-request-id': 'req-42' } });

      expect(kept.headers.get('x-request-id')).toBe('req-42');
      const generated = await post({ customerId: 'c-1', items: [{ sku: 'A-1', quantity: 1 }] });

      expect(generated.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
      expect(generated.headers.get('x-seen-request')).toBe(generated.headers.get('x-request-id'));
    });

    it('continues a well-formed incoming correlation id, starts one at the request otherwise, and echoes it', async () => {
      const continued = await call(`/orders/${KNOWN_ORDER}`, {
        headers: { 'x-correlation-id': 'corr-7', 'x-request-id': 'req-42' },
      });

      expect(continued.headers.get('x-correlation-id')).toBe('corr-7');
      const started = await call(`/orders/${KNOWN_ORDER}`, { headers: { 'x-request-id': 'req-43' } });

      expect(started.headers.get('x-correlation-id')).toBe('req-43');
      const refused = await call('/orders/not-a-uuid', { headers: { 'x-correlation-id': 'corr-8' } });

      expect(refused.headers.get('x-correlation-id')).toBe('corr-8');
    });

    it('runs the handler inside the execution scope of its own request, concurrent requests apart', async () => {
      const answers = await Promise.all(
        ['corr-a', 'corr-b', 'corr-c'].map(async (correlationId) =>
          (await call('/execution', { headers: { 'x-correlation-id': correlationId } })).json(),
        ),
      );

      expect(answers).toEqual([
        { correlationId: 'corr-a', origin: 'http', sameAsHanded: true },
        { correlationId: 'corr-b', origin: 'http', sameAsHanded: true },
        { correlationId: 'corr-c', origin: 'http', sameAsHanded: true },
      ]);

      expect(executionScope.current()).toBeUndefined();
    });
  });
}

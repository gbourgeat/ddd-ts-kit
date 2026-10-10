import { describe, expect, it } from 'vitest';
import type { AdapterClient } from './adapter-client.js';
import { KNOWN_ORDER } from './orders.js';

export function answersAsDeclared({ call, post }: AdapterClient): void {
  describe('answers', () => {
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
  });
}

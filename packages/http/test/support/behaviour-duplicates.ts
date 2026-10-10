import { describe, expect, it } from 'vitest';
import { DuplicateRouteError, type Route } from '../../src/index.js';
import { getOrder, placeOrder } from './orders.js';
import type { StartServer } from './running-server.js';

export function refusesDuplicates(start: StartServer): void {
  describe('duplicates', () => {
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

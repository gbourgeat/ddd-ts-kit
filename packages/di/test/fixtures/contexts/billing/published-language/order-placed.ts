import { err, ok } from '@ddd-ts-kit/kernel';
import type { EventContract } from '@ddd-ts-kit/kernel/declarations';

export interface OrderPlacedPayload {
  readonly orderId: string;
  readonly customerId: string;
}

/** Shaped like a `defineIntegrationEvent` declaration, written by hand to need no schema library. */
export const OrderPlaced: EventContract<OrderPlacedPayload> = {
  type: 'ordering.order.placed',
  version: 1,
  parse(event) {
    if (event.type !== 'ordering.order.placed') return err({ reason: 'type-mismatch' });

    if (event.version !== 1) return err({ reason: 'version-mismatch' });

    const { payload } = event;

    if (typeof payload !== 'object' || payload === null || !('orderId' in payload) || !('customerId' in payload)) {
      return err({ reason: 'invalid-payload' });
    }

    const { orderId, customerId } = payload;

    if (typeof orderId !== 'string' || typeof customerId !== 'string') return err({ reason: 'invalid-payload' });

    return ok({ ...event, payload: { orderId, customerId } });
  },
};

import { err, ok } from '@ddd-ts-kit/kernel';
import type { EventContract } from '../../../../src/index.js';

export interface OrderPlacedPayload {
  readonly orderId: string;
  readonly sku: string;
}

/** Shaped like a `defineIntegrationEvent` declaration, written by hand to need no schema library. */
export const OrderPlaced: EventContract<OrderPlacedPayload> = {
  type: 'ordering.order.placed',
  version: 1,
  parse(event) {
    if (event.type !== this.type) {
      return err({ reason: 'type-mismatch' });
    }

    if (event.version !== this.version) {
      return err({ reason: 'version-mismatch' });
    }

    const { payload } = event;

    if (!isOrderPlacedPayload(payload)) {
      return err({ reason: 'invalid-payload' });
    }

    return ok({ ...event, payload });
  },
};

function isOrderPlacedPayload(payload: unknown): payload is OrderPlacedPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'orderId' in payload &&
    typeof payload.orderId === 'string' &&
    'sku' in payload &&
    typeof payload.sku === 'string'
  );
}

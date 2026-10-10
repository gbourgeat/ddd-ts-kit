import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

/** The event an ordering application announces once an order is placed. */
export function orderPlaced(order: { readonly id: string }): IntegrationEvent {
  return {
    id: `event-${order.id}`,
    type: 'ordering.order.placed',
    version: 1,
    occurredAt: '2026-01-01T00:00:00.000Z',
    payload: { orderId: order.id },
  };
}

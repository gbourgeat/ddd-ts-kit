import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

export const PLACED = 'ordering.order.placed';

export const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';

export const anEvent = (id: string, type = PLACED): IntegrationEvent => ({
  id,
  type,
  version: 1,
  occurredAt: '2026-03-01T10:00:00.000Z',
  payload: { orderId: `order-${id}` },
});

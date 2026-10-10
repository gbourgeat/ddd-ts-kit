import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '@ddd-ts-kit/kernel';
import {
  streamNamesOf,
  type RedisStreamsDelivery,
  type RedisStreamsFailure,
  type StreamNames,
} from '../../src/event-bus.js';

export const PLACED = 'ordering.order.placed';
export const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';

export const unique = (prefix: string): string => `${prefix}-${randomUUID().slice(0, 8)}`;

export const anEvent = (id: string, type = PLACED): IntegrationEvent => ({
  id,
  type,
  version: 1,
  occurredAt: '2026-03-01T10:00:00.000Z',
  payload: { orderId: `order-${id}` },
});

/** The streams of a consumer of the test under the prefix its bus was built with. */
export const streamsOf = (prefix: string, consumer: string, type = PLACED): StreamNames =>
  streamNamesOf({ consumer, type }, (eventType) => `${prefix}:${eventType}`);

export class InvoicingFailed extends Error {
  readonly code = 'INVOICING_FAILED';

  constructor() {
    super('could not invoice jane.doe@example.com');
  }
}

/** A handler that records what it receives and fails its first `failures` deliveries. */
export const recorder = (failures = 0) => {
  const received: IntegrationEvent[] = [];
  let remaining = failures;

  const handler = async (event: IntegrationEvent): Promise<void> => {
    received.push(event);

    if (remaining > 0) {
      remaining -= 1;
      throw new InvoicingFailed();
    }
  };

  return { received, handler, ids: () => received.map((event) => event.id) };
};

export const deliveriesOf = (settled: RedisStreamsDelivery[]) => (delivery: RedisStreamsDelivery) =>
  void settled.push(delivery);

export const failuresOf = (reported: RedisStreamsFailure[]) => (failure: RedisStreamsFailure) =>
  void reported.push(failure);

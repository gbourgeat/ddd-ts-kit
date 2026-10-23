import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

/**
 * The record key decides the order: the events of one aggregate share a key, so they stay on one
 * partition and a consumer receives them as they were published. An event that names no aggregate
 * is produced without a key and ordered with nothing. The relay of the outbox is given the same
 * function with `ordering: 'per-key'` (start-outbox-relay.ts), or the order would be lost before
 * Kafka sees the events. To give up the order for an even spread of the load, remove `keyOf` from
 * the event provider and the two lines of the relay: the key is then the event id.
 */
export function aggregateKeyOf(event: IntegrationEvent): string | undefined {
  const payload: unknown = event.payload;
  const field = aggregateIdFieldOf(event.type);
  const id: unknown = typeof payload === 'object' && payload !== null ? Reflect.get(payload, field) : undefined;

  return typeof id === 'string' ? id : undefined;
}

/** `scheduling.time-slot.booked` names its aggregate in `timeSlotId`: what the generated publishers write. */
function aggregateIdFieldOf(eventType: string): string {
  const aggregate = eventType.split('.')[1] ?? '';

  return aggregate.replace(/-([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase()) + 'Id';
}

import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

/**
 * The record key, which decides the order: the events of one aggregate share a key, so they stay
 * on one partition and a consumer receives them in the order they were published. An event is
 * named `<context>.<aggregate>.<fact>` and its payload names its aggregate as `<aggregate>Id`,
 * which is what the generated publishers write. An event that carries no such field is produced
 * without a key and ordered with nothing. The relay of the outbox is given the same function with
 * `ordering: 'per-key'` (start-outbox-relay.ts), or the order would be lost before Kafka sees the
 * events. To give up the order for an even spread of the load, remove `keyOf` from the event
 * provider and the two lines of the relay: the key is then the event id.
 */
export function aggregateKeyOf(event: IntegrationEvent): string | undefined {
  const aggregate = (event.type.split('.')[1] ?? '').replace(/-([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
  const payload: unknown = event.payload;
  const id: unknown = typeof payload === 'object' && payload !== null ? Reflect.get(payload, aggregate + 'Id') : undefined;

  return typeof id === 'string' ? id : undefined;
}

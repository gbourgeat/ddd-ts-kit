/**
 * The transport a publisher or a subscriber names itself after, read structurally: the event
 * buses carry `messagingSystem` (`rabbitmq`, `kafka`, `nats`, `redis`, `in-memory`), and a
 * publisher that only stores for a relay says `outbox`. What observes them from outside (a
 * trace) reads it; a decorator of a publisher passes it on.
 */
export function messagingSystemOf(provider: object): string | undefined {
  const system: unknown = Reflect.get(provider, 'messagingSystem');

  return typeof system === 'string' ? system : undefined;
}

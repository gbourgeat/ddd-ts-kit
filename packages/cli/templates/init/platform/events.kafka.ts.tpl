import { KafkaEventBus } from '@ddd-ts-kit/kafka';
import { InMemoryEventBus, type EventBus, type IntegrationEvent, type IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import type { AppConfig } from './config.js';

/** The provider integration events are delivered to, and how each consuming context listens to it. */
export interface EventProvider {
  readonly bus: EventBus;
  /** The subscriber of one consuming context, under its own name. */
  subscriberFor(context: string): IntegrationEventSubscriber;
  start(): Promise<void>;
  close(): Promise<void>;
}

/** For the tools and the tests that run without a broker: the same ports, in the process. */
export function inProcessEvents(): EventProvider {
  const bus = new InMemoryEventBus();
  return { bus, subscriberFor: () => bus, start: () => Promise.resolve(), close: () => Promise.resolve() };
}

/**
 * Kafka: the relay of the outbox produces to one topic per event type and marks a record
 * published once the in-sync replicas acknowledged it, each consuming context is a consumer
 * group of its own name and commits an offset after its unit of work committed.
 */
export function createEventProvider(config: AppConfig): EventProvider {
  const bus = new KafkaEventBus({
    brokers: config.kafkaBrokers,
    keyOf: aggregateKeyOf,
    // Codes only reach this hook, never messages: it is safe to log as is.
    onFailure: (failure) => console.error(JSON.stringify({ level: 'error', message: 'event bus failure', ...failure })),
  });
  return {
    bus,
    subscriberFor: (context) => bus.forConsumer(context),
    // Fails at startup, not at the first record.
    start: () => bus.assertTopology(),
    close: () => bus.close(),
  };
}

/**
 * The record key, which decides the order: the events of one aggregate share a key, so they stay
 * on one partition and a consumer receives them in the order they were published. An event is
 * named `<context>.<aggregate>.<fact>` and its payload names its aggregate as `<aggregate>Id`,
 * which is what the generated publishers write. An event that carries no such field is produced
 * without a key and ordered with nothing. The relay of the outbox is given the same function with
 * `ordering: 'per-key'` (outbox-relay.ts), or the order would be lost before Kafka sees the
 * events. To give up the order for an even spread of the load, remove `keyOf` here and the two
 * lines of the relay: the key is then the event id.
 */
export function aggregateKeyOf(event: IntegrationEvent): string | undefined {
  const aggregate = (event.type.split('.')[1] ?? '').replace(/-([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
  const payload: unknown = event.payload;
  const id: unknown = typeof payload === 'object' && payload !== null ? Reflect.get(payload, aggregate + 'Id') : undefined;
  return typeof id === 'string' ? id : undefined;
}

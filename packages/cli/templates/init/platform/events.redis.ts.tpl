import { InMemoryEventBus, type EventBus, type IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { RedisStreamsEventBus } from '@ddd-ts-kit/redis/event-bus';
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
 * Redis Streams, on Redis, Dragonfly or Valkey: the relay of the outbox appends to one stream per
 * event type and marks a record published once the server answered its entry, each consuming
 * context reads through a consumer group of its own name and acknowledges after its unit of work
 * committed. The server is the one of `REDIS_URL`, shared with whatever else the platform keeps there.
 */
export function createEventProvider(config: AppConfig): EventProvider {
  const bus = new RedisStreamsEventBus({
    connection: config.redisUrl,
    // Codes only reach this hook, never messages: it is safe to log as is.
    onFailure: (failure) => console.error(JSON.stringify({ level: 'error', message: 'event bus failure', ...failure })),
  });
  return {
    bus,
    subscriberFor: (context) => bus.forConsumer(context),
    // Fails at startup, not at the first message.
    start: () => bus.assertTopology(),
    close: () => bus.close(),
  };
}

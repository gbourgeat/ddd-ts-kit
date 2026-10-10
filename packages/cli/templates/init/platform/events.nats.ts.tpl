import { InMemoryEventBus, type EventBus, type IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { NatsEventBus } from '@ddd-ts-kit/nats';
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
 * NATS JetStream: the relay of the outbox publishes to one stream and marks a record published
 * once the stream acknowledged it (a second publication of the same event id is dropped by the
 * stream), each consuming context reads through durable consumers of its own name and
 * acknowledges after its unit of work committed.
 */
export function createEventProvider(config: AppConfig): EventProvider {
  const bus = new NatsEventBus({
    connection: config.natsUrl,
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

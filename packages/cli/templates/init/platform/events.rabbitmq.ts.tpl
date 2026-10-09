import { InMemoryEventBus, type EventBus, type IntegrationEventSubscriber } from '@ddd-ts-kit/kernel';
import { RabbitMqEventBus } from '@ddd-ts-kit/rabbitmq';
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
 * RabbitMQ: the relay of the outbox publishes with publisher confirms, each consuming context
 * reads its own durable queues and acknowledges after its unit of work committed.
 */
export function createEventProvider(config: AppConfig): EventProvider {
  const bus = new RabbitMqEventBus({
    connection: config.amqpUrl,
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

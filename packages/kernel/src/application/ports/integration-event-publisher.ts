import type { IntegrationEvent } from '../events/integration-event.js';

/** What use cases publish through, for any provider: in-memory, outbox and broker, SQS, Kafka, NATS, RabbitMQ. */
export abstract class IntegrationEventPublisher {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.IntegrationEventPublisher' });
  }

  abstract publish(events: readonly IntegrationEvent[]): Promise<void>;
}

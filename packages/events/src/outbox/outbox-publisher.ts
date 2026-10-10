import type { IntegrationEvent, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import type { OutboxStore } from './outbox-store.js';

/**
 * The publisher handlers use when a database is involved: it only stores. Called inside the
 * unit of work of the command, the events commit or roll back with the business write.
 */
export class OutboxPublisher implements IntegrationEventPublisher {
  /** Read by what observes the publisher from outside: it stores, a relay sends later. */
  readonly messagingSystem = 'outbox';

  constructor(private readonly store: OutboxStore) {}

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    if (events.length > 0) {
      await this.store.append(events);
    }
  }
}

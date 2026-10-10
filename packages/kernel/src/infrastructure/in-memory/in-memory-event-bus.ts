import type { IntegrationEventCallback } from '../../application/events/integration-event-callback.js';
import type { IntegrationEvent } from '../../application/events/integration-event.js';
import type { Subscription } from '../../application/events/subscription.js';
import type { IntegrationEventPublisher } from '../../application/ports/integration-event-publisher.js';
import type { IntegrationEventSubscriber } from '../../application/ports/integration-event-subscriber.js';

/**
 * Reference provider for IntegrationEvents, for tests, local dev and single-process apps.
 * Delivery is at-least-once-shaped: handlers are awaited in order, a failing handler
 * does not stop the others, and failures are collected and rethrown together.
 */
export class InMemoryEventBus implements IntegrationEventPublisher, IntegrationEventSubscriber {
  /** Read by what observes the bus from outside: the name of the transport. */
  readonly messagingSystem = 'in-memory';

  readonly published: IntegrationEvent[] = [];

  private readonly handlers = new Map<string, Set<IntegrationEventCallback>>();

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    const failures: unknown[] = [];

    for (const event of events) {
      this.published.push(event);

      for (const handler of this.handlers.get(event.type) ?? []) {
        try {
          await handler(event, { attempt: 1, system: this.messagingSystem, destination: event.type });
        } catch (error) {
          failures.push(error);
        }
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, `${failures.length} event handler(s) failed`);
    }
  }

  subscribe(type: string, handler: IntegrationEventCallback): Subscription {
    const set = this.handlers.get(type) ?? new Set();

    set.add(handler);
    this.handlers.set(type, set);

    return { unsubscribe: () => void set.delete(handler) };
  }
}

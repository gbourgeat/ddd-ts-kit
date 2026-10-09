import type {
  IntegrationEvent,
  IntegrationEventHandler,
  IntegrationEventPublisher,
  IntegrationEventSubscriber,
  ProcessedEventStore,
  Subscription,
} from '../application/integration-event.js';
import type {
  DomainEventDispatcher,
  DomainEventHandler,
} from '../application/domain-event-dispatcher.js';
import type { DomainEvent } from '../domain/domain-event.js';

/**
 * Reference provider for IntegrationEvents, for tests, local dev and single-process apps.
 * Delivery is at-least-once-shaped: handlers are awaited in order, a failing handler
 * does not stop the others, and failures are collected and rethrown together.
 */
export class InMemoryEventBus implements IntegrationEventPublisher, IntegrationEventSubscriber {
  readonly published: IntegrationEvent[] = [];
  readonly #handlers = new Map<string, Set<IntegrationEventHandler>>();

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    const failures: unknown[] = [];
    for (const event of events) {
      this.published.push(event);
      for (const handler of this.#handlers.get(event.type) ?? []) {
        try {
          await handler(event);
        } catch (error) {
          failures.push(error);
        }
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, `${failures.length} event handler(s) failed`);
    }
  }

  subscribe(type: string, handler: IntegrationEventHandler): Subscription {
    const set = this.#handlers.get(type) ?? new Set();
    set.add(handler);
    this.#handlers.set(type, set);
    return { unsubscribe: () => void set.delete(handler) };
  }
}

export class InMemoryDomainEventDispatcher implements DomainEventDispatcher {
  readonly #handlers = new Map<string, DomainEventHandler[]>();

  on(name: string, handler: DomainEventHandler): void {
    this.#handlers.set(name, [...(this.#handlers.get(name) ?? []), handler]);
  }

  async dispatch(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      for (const handler of this.#handlers.get(event.name) ?? []) {
        await handler(event);
      }
    }
  }
}

export class InMemoryProcessedEventStore implements ProcessedEventStore {
  readonly #seen = new Set<string>();

  async markProcessed(consumer: string, eventId: string): Promise<boolean> {
    const key = keyOf(consumer, eventId);
    if (this.#seen.has(key)) return false;
    this.#seen.add(key);
    return true;
  }

  async release(consumer: string, eventId: string): Promise<void> {
    this.#seen.delete(keyOf(consumer, eventId));
  }
}

// JSON keeps the pair unambiguous: 'a:b' + 'c' must not equal 'a' + 'b:c'.
function keyOf(consumer: string, eventId: string): string {
  return JSON.stringify([consumer, eventId]);
}

/**
 * Wraps a handler so a redelivered event is processed once per consumer. A failed handler
 * gives its mark back, otherwise the redelivery would be skipped and the event lost.
 */
export function idempotent(
  consumer: string,
  store: ProcessedEventStore,
  handler: IntegrationEventHandler,
): IntegrationEventHandler {
  return async (event) => {
    if (!(await store.markProcessed(consumer, event.id))) return;
    try {
      await handler(event);
    } catch (error) {
      await store.release?.(consumer, event.id);
      throw error;
    }
  };
}

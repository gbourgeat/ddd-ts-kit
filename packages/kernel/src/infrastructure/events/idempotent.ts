import type { IntegrationEventCallback } from '../../application/events/integration-event-callback.js';
import type { ProcessedEventStore } from '../../application/ports/processed-event-store.js';

/**
 * Wraps a handler so a redelivered event is processed once per consumer. A failed handler
 * gives its mark back, otherwise the redelivery would be skipped and the event lost.
 */
export function idempotent(
  consumer: string,
  store: ProcessedEventStore,
  handler: IntegrationEventCallback,
): IntegrationEventCallback {
  return async (event, delivery) => {
    if (!(await store.markProcessed(consumer, event.id))) {
      return;
    }

    try {
      await handler(event, delivery);
    } catch (error) {
      await store.release?.(consumer, event.id);
      throw error;
    }
  };
}

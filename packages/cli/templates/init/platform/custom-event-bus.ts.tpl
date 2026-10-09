import { InMemoryEventBus, type EventBus, type IntegrationEvent, type IntegrationEventHandler, type Subscription } from '@ddd-ts-kit/kernel';

/**
 * The adapter of the `EventBus` port for your broker or queue service. This stub delivers in
 * the process so that the application runs; custom-event-bus.contract.spec.ts holds whatever
 * replaces it to what the outbox relay and the consumers rely on.
 */
// TODO(platform): publish with a confirmation of the broker (resolve only once it took every event, reject otherwise) and consume from one durable queue per consumer, acknowledging after the handler succeeded.
export class CustomEventBus implements EventBus {
  readonly #delivery = new InMemoryEventBus();

  publish(events: readonly IntegrationEvent[]): Promise<void> {
    return this.#delivery.publish(events);
  }

  subscribe(eventType: string, handler: IntegrationEventHandler): Subscription {
    return this.#delivery.subscribe(eventType, handler);
  }
}

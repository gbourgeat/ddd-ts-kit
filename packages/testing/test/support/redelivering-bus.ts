import { EventBus, type IntegrationEvent, type IntegrationEventCallback, type Subscription } from '@ddd-ts-kit/kernel';

/**
 * A bus that behaves as a broker does: `publish` only hands the events over, each subscriber gets
 * them later, and an event its handler failed on comes back to that handler until it goes through.
 */
export class RedeliveringBus extends EventBus {
  private readonly handlers = new Map<string, Set<IntegrationEventCallback>>();

  private readonly deliveries: Promise<void>[] = [];

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    for (const event of events) {
      for (const handler of this.handlers.get(event.type) ?? []) {
        this.deliveries.push(this.deliver(handler, event));
      }
    }
  }

  subscribe(type: string, handler: IntegrationEventCallback): Subscription {
    const handlers = this.handlers.get(type) ?? new Set();

    handlers.add(handler);
    this.handlers.set(type, handlers);

    return { unsubscribe: () => void handlers.delete(handler) };
  }

  /** Resolves once every event handed over so far went through. */
  async settle(): Promise<void> {
    while (this.deliveries.length > 0) {
      await Promise.all(this.deliveries.splice(0));
    }
  }

  private async deliver(handler: IntegrationEventCallback, event: IntegrationEvent): Promise<void> {
    await Promise.resolve();
    await handler(event).catch(() => this.deliver(handler, event));
  }
}

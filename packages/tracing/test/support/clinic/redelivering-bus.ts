import type { EventBus, IntegrationEvent, IntegrationEventCallback, Subscription } from '@ddd-ts-kit/kernel';

/**
 * A bus that behaves as a broker does: each consumer gets its own deliveries, a failed one is
 * delivered again, with its attempt number, until the attempts are spent, and then the event is
 * given up for that consumer. The publisher never hears of it.
 */
export class RedeliveringBus implements EventBus {
  readonly messagingSystem = 'test-broker';

  /** The events given up, as `<event id> for <handler position>`. */
  readonly dead: string[] = [];

  private readonly handlers = new Map<string, IntegrationEventCallback[]>();

  constructor(private readonly maxAttempts = 3) {}

  async publish(events: readonly IntegrationEvent[]): Promise<void> {
    for (const event of events) {
      for (const [position, handler] of (this.handlers.get(event.type) ?? []).entries()) {
        if (!(await this.delivered(event, handler))) this.dead.push(`${event.id} for ${position}`);
      }
    }
  }

  subscribe(type: string, handler: IntegrationEventCallback): Subscription {
    const handlers = this.handlers.get(type) ?? [];

    handlers.push(handler);
    this.handlers.set(type, handlers);

    return { unsubscribe: () => void handlers.splice(handlers.indexOf(handler), 1) };
  }

  private async delivered(event: IntegrationEvent, handler: IntegrationEventCallback): Promise<boolean> {
    const { maxAttempts, messagingSystem: system } = this;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await handler(event, { attempt, maxAttempts, system, destination: `queue.${event.type}` });

        return true;
      } catch {
        continue;
      }
    }

    return false;
  }
}

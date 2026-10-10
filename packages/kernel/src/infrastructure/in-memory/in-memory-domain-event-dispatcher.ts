import type { DomainEventCallback } from '../../application/events/domain-event-callback.js';
import type { DomainEventDispatcher } from '../../application/ports/domain-event-dispatcher.js';
import type { DomainEvent } from '../../domain/domain-event.js';

export class InMemoryDomainEventDispatcher implements DomainEventDispatcher {
  private readonly handlers = new Map<string, DomainEventCallback[]>();

  on(name: string, handler: DomainEventCallback): void {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler]);
  }

  async dispatch(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      for (const handler of this.handlers.get(event.name) ?? []) {
        await handler(event);
      }
    }
  }
}

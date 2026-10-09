import type { DomainEvent } from '../domain/domain-event.js';

export type DomainEventHandler<E extends DomainEvent = DomainEvent> = (event: E) => Promise<void>;

/** In-context, synchronous-in-transaction reactions. Cross-context reactions use IntegrationEvents. */
export interface DomainEventDispatcher {
  dispatch(events: readonly DomainEvent[]): Promise<void>;
  on(name: string, handler: DomainEventHandler): void;
}

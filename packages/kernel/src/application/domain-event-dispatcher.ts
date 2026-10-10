import type { DomainEvent } from '../domain/domain-event.js';

/** What a dispatcher is given for one event name: the function it calls with each event. */
export type DomainEventCallback<E extends DomainEvent = DomainEvent> = (event: E) => Promise<void>;

/**
 * @deprecated Renamed `DomainEventCallback`: `DomainEventHandler` is the decorator, and the shape
 * of the class it decorates, of `@ddd-ts-kit/kernel/declarations`.
 */
export type DomainEventHandler<E extends DomainEvent = DomainEvent> = DomainEventCallback<E>;

/** In-context, synchronous-in-transaction reactions. Cross-context reactions use IntegrationEvents. */
export interface DomainEventDispatcher {
  dispatch(events: readonly DomainEvent[]): Promise<void>;
  on(name: string, handler: DomainEventCallback): void;
}

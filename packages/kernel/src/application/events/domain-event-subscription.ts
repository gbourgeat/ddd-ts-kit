import type { DomainEventPhase } from './domain-event-phase';

/** How a callback is attached to a dispatcher. */
export interface DomainEventSubscription {
  /** Default `before-commit`. */
  readonly phase?: DomainEventPhase;
}

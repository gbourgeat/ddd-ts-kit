import { Entity } from './entity.js';
import type { DomainEvent } from './domain-event.js';

/**
 * Consistency boundary and transaction boundary. Only the root is reachable from
 * outside; state changes go through intention-revealing methods that guard the
 * invariants and record domain events.
 */
export abstract class AggregateRoot<Id extends string | number = string> extends Entity<Id> {
  /** Optimistic concurrency token, managed by the repository adapter. */
  version = 0;

  #events: DomainEvent[] = [];

  /** Hands the recorded events to the application layer and clears them. */
  pullEvents(): DomainEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }

  protected record(event: DomainEvent): void {
    this.#events.push(event);
  }
}

import type { DomainEvent } from './domain-event.js';
import { Entity } from './entity.js';

/**
 * Consistency boundary and transaction boundary. Only the root is reachable from
 * outside; state changes go through intention-revealing methods that guard the
 * invariants and record domain events.
 */
export abstract class AggregateRoot<Id extends string | number = string> extends Entity<Id> {
  /** Optimistic concurrency token, managed by the repository adapter. */
  version = 0;

  private readonly events: DomainEvent[] = [];

  /**
   * The recorded events are no part of the state: they are kept out of enumeration, so that
   * comparing, spreading or serialising an aggregate never sees what it has yet to announce.
   */
  protected constructor(id: Id) {
    super(id);
    Object.defineProperty(this, 'events', { enumerable: false });
  }

  /**
   * Hands over the recorded events and clears them. Called for a handler by the save of the
   * repository (`dispatchingOnSave`), and by a spec that asserts what an aggregate recorded;
   * never by a use case or a repository adapter.
   */
  pullEvents(): DomainEvent[] {
    return this.events.splice(0);
  }

  protected record(event: DomainEvent): void {
    this.events.push(event);
  }
}

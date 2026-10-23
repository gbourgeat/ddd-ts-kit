import { AggregateRoot } from '../aggregate-root';
import type { DomainEvent } from '../domain-event';
import type { AggregateHistory } from './aggregate-history';
import type { Appliers } from './appliers';
import { unstoredEvents } from './unstored-events';

/**
 * An aggregate whose state is the sum of its events. A command checks the invariants, then
 * records the event of what it decided; recording applies the event through the apply method
 * the aggregate declares for it in `appliers`, and only apply methods change the state. Loading
 * replays the stream, from a snapshot when one was taken, through the same apply methods,
 * recording nothing. `version` is the number of events of the stream the aggregate reflects:
 * the version the stream must still have when its new events are appended.
 *
 * Chosen per aggregate: the other aggregates of a context keep their state in tables.
 */
export abstract class EventSourcedAggregate<E extends DomainEvent, S = never> extends AggregateRoot<string> {
  protected constructor(id: string) {
    super(id);
    unstoredEvents.set(this, []);
  }

  /** The apply method of each event this aggregate records, by the name the event carries. */
  protected abstract appliers(): Appliers<E>;

  /** Applies the event, then keeps it for the next save, which stores it and dispatches it. */
  protected override record(event: E): void {
    this.applyEvent(event);
    super.record(event);
    unstoredEvents.get(this)?.push(event);
  }

  /**
   * Rebuilds the state from the history of the stream and records nothing. A history that starts
   * from a snapshot needs `restore`, which takes the state the snapshot kept.
   */
  protected replay(history: AggregateHistory<E, S>, restore?: (state: S) => void): this {
    const { snapshot, events } = history;

    if (snapshot !== undefined) {
      if (restore === undefined) {
        throw new TypeError(`${this.constructor.name} was given a snapshot and restores none: pass restore to replay`);
      }

      restore(snapshot.state);
      this.version = snapshot.version;
    }

    for (const event of events) {
      this.applyEvent(event);
      this.version += 1;
    }

    return this;
  }

  private applyEvent(event: E): void {
    const apply: unknown = Reflect.get(this.appliers(), event.name);

    if (typeof apply !== 'function') {
      throw new TypeError(`${this.constructor.name} has no apply method for "${event.name}"`);
    }

    Reflect.apply(apply, this, [event]);
  }
}

import type { DomainEvent } from '../domain-event';
import type { AggregateSnapshot } from './aggregate-snapshot';

/** What an event-sourced aggregate is rebuilt from: its stream, read from a snapshot when one was taken. */
export interface AggregateHistory<E extends DomainEvent, S = never> {
  /** The state at a version of the stream: only the events after it follow. */
  readonly snapshot?: AggregateSnapshot<S>;
  /** In the order they were recorded. */
  readonly events: readonly E[];
}

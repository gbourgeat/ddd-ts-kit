import type { AggregateHistory, DomainEvent, SnapshotPolicy } from '@ddd-ts-kit/kernel';

/** What `expectSnapshotEquivalence` replays, both ways. */
export interface SnapshotEquivalence<A, E extends DomainEvent, S> {
  /** A history long enough to cross the snapshot interval, in order. */
  readonly events: readonly E[];
  rehydrate(id: string, history: AggregateHistory<E, S>): A;
  /** The snapshot policy of the repository: its `encode` and `decode` are what is proven. */
  readonly policy: Pick<SnapshotPolicy<A, S>, 'encode' | 'decode'>;
  /** What two aggregates must share: their state as a value. */
  state(aggregate: A): unknown;
}

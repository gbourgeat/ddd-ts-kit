import type { StoredEventData } from '../../application/event-sourcing/stored-event-data';
import type { SnapshotStore } from '../../application/ports/snapshot-store';

/** When and how an event-sourced repository keeps snapshots of its aggregates: a choice per aggregate. */
export interface SnapshotPolicy<A, S> {
  readonly store: SnapshotStore;
  /** A snapshot is taken by the save that makes the stream reach a multiple of this many events. */
  readonly every: number;
  /** The version of the shape `encode` writes: a snapshot of another version is ignored, the stream replayed from its start. */
  readonly version: number;
  /** The state to keep, as plain data. */
  encode(aggregate: A): object;
  decode(data: StoredEventData): S;
}

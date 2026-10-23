import type { InMemoryRepositoryOptions } from './in-memory-repository';
import type { SnapshotCodec } from './snapshot-codec';

/** Infers the snapshot type so `toSnapshot` and `fromSnapshot` are checked against each other. */
export function snapshots<A, Snapshot>(codec: SnapshotCodec<A, Snapshot>): InMemoryRepositoryOptions<A> {
  return {
    toSnapshot: codec.toSnapshot,
    // eslint-disable-next-line ddd-ts-kit/clean-no-escape-hatch -- the options erase the snapshot type, and only values produced by `toSnapshot` above are ever passed back
    fromSnapshot: (snapshot) => codec.fromSnapshot(snapshot as Snapshot),
  };
}

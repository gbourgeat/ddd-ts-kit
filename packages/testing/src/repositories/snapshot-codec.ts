/** The pair a mapper already has: an aggregate to plain data, and back. */
export interface SnapshotCodec<A, Snapshot> {
  readonly toSnapshot: (aggregate: A) => Snapshot;
  readonly fromSnapshot: (snapshot: Snapshot) => A;
}

/**
 * An effect outside the database that must land with a commit: `apply` runs inside the
 * transaction, as its last step, and `undo` when the transaction rolls back all the same.
 */
export interface CommitStep {
  readonly apply: () => Promise<void>;
  /** Reverses `apply` as far as it can; it reports its own failure, which is dropped. */
  readonly undo: () => Promise<void>;
}

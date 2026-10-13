import type { UnitOfWorkScope } from './unit-of-work-scope.js';

interface StagedWrite {
  readonly write: () => Promise<void>;
  /** Who to tell when the write fails. */
  readonly failed: (error: unknown) => void;
}

/** The writes each running unit of work holds until its commit, for stores the transaction cannot cover. Gone with the scope when it rolls back. */
export const stagedWrites = new WeakMap<UnitOfWorkScope, StagedWrite[]>();

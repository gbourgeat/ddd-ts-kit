import type { AuditCheckpoint } from './audit-checkpoint.js';

export interface SealingOptions {
  /** A checkpoint is handed over each time the sequence of a chain is a multiple of it. */
  readonly every: number;

  /**
   * Runs when the entry is written, inside the unit of work when there is one: appending the
   * checkpoint to an outbox there makes it commit with the entry. A hook that calls a remote
   * service directly may anchor an entry whose transaction rolls back afterwards.
   */
  onSeal(checkpoint: AuditCheckpoint): void | Promise<void>;
}

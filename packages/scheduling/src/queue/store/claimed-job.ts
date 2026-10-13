import type { EnqueuedBy } from '@ddd-ts-kit/kernel';

/** A job handed to a worker, with what its run needs. */
export interface ClaimedJob {
  readonly id: string;
  readonly name: string;
  readonly queue: string;
  readonly payload: unknown;
  readonly enqueuedBy: EnqueuedBy;
  readonly enqueuedAt: Date;
  /** This claim: 1 the first time, counted at each claim. */
  readonly attempt: number;
  /** What an earlier attempt saved, absent on a fresh start. */
  readonly checkpoint?: unknown;
}

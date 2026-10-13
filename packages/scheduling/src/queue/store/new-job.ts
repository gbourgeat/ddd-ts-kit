import type { EnqueuedBy } from '@ddd-ts-kit/kernel';

/** A job as `enqueue` hands it to the store. */
export interface NewJob {
  readonly id: string;
  readonly name: string;
  readonly queue: string;
  /** Plain JSON. */
  readonly payload: unknown;
  readonly enqueuedBy: EnqueuedBy;
  readonly enqueuedAt: Date;
  readonly runAt: Date;
  readonly idempotencyKey?: string;
}

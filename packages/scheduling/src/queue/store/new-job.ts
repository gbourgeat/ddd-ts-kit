import type { EnqueuedBy } from '@ddd-ts-kit/kernel';

/** A job as `enqueue` hands it to the store. */
export interface NewJob {
  readonly id: string;
  readonly name: string;
  readonly queue: string;
  /** Plain JSON. */
  readonly payload: unknown;
  /** Its `tenantId`, when present, scopes the idempotency key: two tenants never share one. */
  readonly enqueuedBy: EnqueuedBy;
  readonly enqueuedAt: Date;
  readonly runAt: Date;
  readonly idempotencyKey?: string;
  /** What the job works on, answered by `find`. */
  readonly subject?: string;
}

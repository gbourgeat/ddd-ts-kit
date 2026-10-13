import type { EnqueuedBy } from '@ddd-ts-kit/kernel';

/**
 * The tenant part of the idempotency key of a job, for a store that keeps it in a column of a
 * unique index: the tenant, or the empty text for a job enqueued outside any tenant, because a
 * null would make every such key distinct on PostgreSQL before 15.
 */
export function tenantKeyOf(enqueuedBy: EnqueuedBy): string {
  return enqueuedBy.tenantId ?? '';
}

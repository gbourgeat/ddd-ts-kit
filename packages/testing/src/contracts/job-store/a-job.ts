import type { EnqueuedBy } from '@ddd-ts-kit/kernel';
import { NOW, QUEUE } from './job-fixtures.js';

const ENQUEUED_BY: EnqueuedBy = {
  correlationId: 'corr-1',
  actor: { id: 'user-7', type: 'user', tenantId: 'tenant-3', roles: ['accountant'], attributes: {} },
  tenantId: 'tenant-3',
  traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
};

export interface JobOverrides {
  readonly name?: string;
  readonly queue?: string;
  readonly runAt?: Date;
  readonly idempotencyKey?: string;
  readonly payload?: unknown;
}

/** A job of the contract: `billing.compile-statements`, due at `NOW` unless told otherwise. */
export function aJob(id: string, overrides: JobOverrides = {}) {
  const { name = 'billing.compile-statements', queue = QUEUE, runAt = NOW, idempotencyKey } = overrides;

  return {
    id,
    name,
    queue,
    payload: overrides.payload ?? { month: '2026-02', customers: ['c-1', 'c-2'], draft: false, total: 12.5 },
    enqueuedBy: ENQUEUED_BY,
    enqueuedAt: NOW,
    runAt,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  };
}

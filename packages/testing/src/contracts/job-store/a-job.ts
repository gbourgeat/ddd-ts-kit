import type { EnqueuedBy } from '@ddd-ts-kit/kernel';
import { NOW, QUEUE } from './job-fixtures.js';

const TENANT = 'tenant-3';

const TRACEPARENT = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';

export interface JobOverrides {
  readonly name?: string;
  readonly queue?: string;
  readonly runAt?: Date;
  readonly idempotencyKey?: string;
  readonly payload?: unknown;
  /** The tenant of the work that enqueues it: `tenant-3` by default, `null` for none. */
  readonly tenantId?: string | null;
  readonly subject?: string;
}

/** A job of the contract: `billing.compile-statements`, due at `NOW` unless told otherwise. */
export function aJob(id: string, overrides: JobOverrides = {}) {
  const { name = 'billing.compile-statements', queue = QUEUE, runAt = NOW, idempotencyKey, subject } = overrides;

  return {
    id,
    name,
    queue,
    payload: overrides.payload ?? { month: '2026-02', customers: ['c-1', 'c-2'], draft: false, total: 12.5 },
    enqueuedBy: enqueuedBy(overrides.tenantId === undefined ? TENANT : overrides.tenantId),
    enqueuedAt: NOW,
    runAt,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    ...(subject === undefined ? {} : { subject }),
  };
}

function enqueuedBy(tenantId: string | null): EnqueuedBy {
  const tenant = tenantId === null ? {} : { tenantId };

  return {
    correlationId: 'corr-1',
    actor: { id: 'user-7', type: 'user', ...tenant, roles: ['accountant'], attributes: {} },
    ...tenant,
    traceparent: TRACEPARENT,
  };
}

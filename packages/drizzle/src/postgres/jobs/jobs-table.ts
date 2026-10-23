import { sql } from 'drizzle-orm';
import { bigint, index, integer, jsonb, text, uniqueIndex } from 'drizzle-orm/pg-core';
import type { EnqueuedBy, JobProgress, QueuedJobStatus } from '@ddd-ts-kit/kernel';
import { instant } from '../columns/instant';
import { tableIn } from '../schema/table-in';

export type JobsTable = ReturnType<typeof jobsTable>;

/**
 * The table of the background jobs, to include in the schema files drizzle-kit reads so that
 * it is created by the migrations of the project. In the schema of a context, the jobs of that
 * context travel with it when it is extracted as a service.
 */
export function jobsTable(schemaName?: string) {
  return tableIn(schemaName)(
    'background_jobs',
    {
      id: text('id').primaryKey(),
      /** Insertion order, the tie-breaker of the claim. */
      sequence: bigint('sequence', { mode: 'number' }).generatedAlwaysAsIdentity(),
      name: text('name').notNull(),
      queue: text('queue').notNull(),
      payload: jsonb('payload'),
      enqueuedBy: jsonb('enqueued_by').$type<EnqueuedBy>().notNull(),
      idempotencyKey: text('idempotency_key'),
      /** The empty text outside any tenant: a null would make every such key distinct. */
      tenantId: text('tenant_id').notNull().default(''),
      subject: text('subject'),
      status: text('status').$type<QueuedJobStatus>().notNull().default('waiting'),
      attempts: integer('attempts').notNull().default(0),
      runAt: instant('run_at').notNull(),
      leaseUntil: instant('lease_until'),
      progress: jsonb('progress').$type<JobProgress>(),
      checkpoint: jsonb('checkpoint'),
      lastErrorCode: text('last_error_code'),
      enqueuedAt: instant('enqueued_at').notNull(),
      finishedAt: instant('finished_at'),
    },
    (table) => [
      uniqueIndex('background_jobs_idempotency_key').on(table.name, table.tenantId, table.idempotencyKey),
      // Partial: a claim only ever looks at what is waiting or running, and finished jobs dominate.
      index('background_jobs_due_idx')
        .on(table.queue, table.runAt, table.sequence)
        .where(sql`${table.status} in ('waiting', 'running')`),
    ],
  );
}

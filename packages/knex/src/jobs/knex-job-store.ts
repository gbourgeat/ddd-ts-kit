import type { Knex } from 'knex';
import type { EnqueuedJob, QueuedJob } from '@ddd-ts-kit/kernel';
import type {
  ClaimedJob,
  ClaimRequest,
  JobFailure,
  JobLease,
  JobStore,
  JobStoreStats,
  JobUpdate,
  NewJob,
} from '@ddd-ts-kit/scheduling';
import type { KnexContext } from '../unit-of-work/knex-context.js';
import { claimedOfRow } from './claimed-of-row.js';
import { jobOfRow } from './job-of-row.js';
import type { JobRow } from './job-row.js';
import { JOB_TABLE } from './job-table-name.js';
import type { JobTableOptions } from './job-table-options.js';

type Rows = Knex.QueryBuilder<JobRow, JobRow[]>;

/**
 * The background jobs in a PostgreSQL table. `add` runs on the executor of the context: inside a
 * unit of work, the job is written by the transaction of the command and shares its fate. Claims
 * take due rows `FOR UPDATE SKIP LOCKED` in a short transaction of their own, so several workers
 * pass over each other's rows instead of waiting.
 */
export class KnexJobStore implements JobStore {
  private readonly schemaName: string | undefined;

  private readonly tableName: string;

  constructor(
    private readonly context: KnexContext,
    options: JobTableOptions = {},
  ) {
    this.schemaName = options.schema;
    this.tableName = options.table ?? JOB_TABLE;
  }

  async add(job: NewJob): Promise<EnqueuedJob> {
    const executor = this.context.executor();

    const inserted: unknown[] = await this.rows(executor)
      .insert(rowOf(job))
      .onConflict(['name', 'idempotency_key'])
      .ignore()
      .returning('id');

    if (inserted.length === 1 || job.idempotencyKey === undefined) {
      return { id: job.id, duplicate: false };
    }

    const kept = await this.rows(executor).where({ name: job.name, idempotency_key: job.idempotencyKey }).first('id');

    return { id: kept?.id ?? job.id, duplicate: true };
  }

  claim(request: ClaimRequest): Promise<ClaimedJob[]> {
    if (request.limit <= 0) {
      return Promise.resolve([]);
    }

    return this.context.executor().transaction(async (transaction) => {
      const due = await this.due(transaction, request).forUpdate().skipLocked();

      if (due.length > 0) {
        await this.rows(transaction)
          .whereIn(
            'id',
            due.map((row) => row.id),
          )
          .update({
            status: 'running',
            attempts: transaction.raw('?? + 1', ['attempts']),
            lease_until: new Date(request.now.getTime() + request.leaseMs),
          });
      }

      return due.map(claimedOfRow);
    });
  }

  heartbeat(lease: JobLease, leaseUntil: Date): Promise<boolean> {
    return this.holding(lease, { lease_until: leaseUntil });
  }

  update(lease: JobLease, update: JobUpdate, leaseUntil: Date): Promise<boolean> {
    return this.holding(lease, {
      lease_until: leaseUntil,
      ...(update.progress === undefined ? {} : { progress: JSON.stringify(update.progress) }),
      ...('checkpoint' in update ? { checkpoint: jsonOrNull(update.checkpoint) } : {}),
    });
  }

  complete(lease: JobLease, at: Date): Promise<boolean> {
    return this.holding(lease, { status: 'succeeded', finished_at: at, lease_until: null });
  }

  fail(lease: JobLease, { errorCode, retryAt, at }: JobFailure): Promise<boolean> {
    const next =
      retryAt === null
        ? { status: 'dead', finished_at: at, lease_until: null }
        : { status: 'waiting', run_at: retryAt, lease_until: null };

    return this.holding(lease, { ...next, last_error_code: errorCode });
  }

  release(lease: JobLease, runAt: Date): Promise<boolean> {
    const executor = this.context.executor();

    return this.holding(lease, {
      status: 'waiting',
      run_at: runAt,
      lease_until: null,
      attempts: executor.raw('?? - 1', ['attempts']),
    });
  }

  async cancel(id: string, at: Date): Promise<boolean> {
    const changed = await this.rows(this.context.executor())
      .where({ id })
      .whereIn('status', ['waiting', 'running'])
      .update({ status: 'cancelled', finished_at: at, lease_until: null });

    return changed === 1;
  }

  async find(id: string): Promise<QueuedJob | undefined> {
    const row = await this.rows(this.context.executor()).where({ id }).first();

    return row === undefined ? undefined : jobOfRow(row);
  }

  async retryDead(ids: readonly string[], now: Date): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    return this.rows(this.context.executor())
      .whereIn('id', [...ids])
      .where({ status: 'dead' })
      .update({ status: 'waiting', attempts: 0, run_at: now, finished_at: null });
  }

  purgeFinished(before: Date): Promise<number> {
    return this.rows(this.context.executor())
      .whereIn('status', ['succeeded', 'cancelled'])
      .where('finished_at', '<', before)
      .delete();
  }

  async stats(queue: string): Promise<JobStoreStats> {
    const counted: { status: string; count: number | string }[] = await this.rows(this.context.executor())
      .where({ queue })
      .whereIn('status', ['waiting', 'running', 'dead'])
      .groupBy('status')
      .select('status')
      .count({ count: '*' });

    const of = (status: string) => Number(counted.find((row) => row.status === status)?.count ?? 0);

    return { waiting: of('waiting'), running: of('running'), dead: of('dead') };
  }

  private due(executor: Knex, { queue, limit, now }: ClaimRequest): Rows {
    return this.rows(executor)
      .select('*')
      .where({ queue })
      .where((due) => {
        void due
          .where((waiting) => void waiting.where({ status: 'waiting' }).where('run_at', '<=', now))
          .orWhere((expired) => void expired.where({ status: 'running' }).where('lease_until', '<=', now));
      })
      .orderBy([{ column: 'run_at' }, { column: 'sequence' }])
      .limit(limit);
  }

  /** Changes the row only while this attempt holds it. */
  private async holding(lease: JobLease, change: Readonly<Record<string, unknown>>): Promise<boolean> {
    const changed = await this.rows(this.context.executor())
      .where({ id: lease.id, status: 'running', attempts: lease.attempt })
      .update(change);

    return changed === 1;
  }

  private rows(executor: Knex): Rows {
    const table = executor<JobRow, JobRow[]>(this.tableName);

    return this.schemaName === undefined ? table : table.withSchema(this.schemaName);
  }
}

function rowOf(job: NewJob): Readonly<Record<string, unknown>> {
  return {
    id: job.id,
    name: job.name,
    queue: job.queue,
    // Serialized here: drivers would send a JS array as a SQL array, not as JSON.
    payload: jsonOrNull(job.payload),
    enqueued_by: JSON.stringify(job.enqueuedBy),
    idempotency_key: job.idempotencyKey ?? null,
    run_at: job.runAt,
    enqueued_at: job.enqueuedAt,
  };
}

function jsonOrNull(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

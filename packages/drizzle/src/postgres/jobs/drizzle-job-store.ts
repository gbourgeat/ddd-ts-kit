import { and, eq, inArray, lt, lte, or, sql, type SQL, type TablesRelationalConfig } from 'drizzle-orm';
import type { PgQueryResultHKT, PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { EnqueuedJob, QueuedJob } from '@ddd-ts-kit/kernel';
import {
  tenantKeyOf,
  type ClaimedJob,
  type ClaimRequest,
  type JobFailure,
  type JobLease,
  type JobStore,
  type JobStoreStats,
  type JobUpdate,
  type NewJob,
} from '@ddd-ts-kit/scheduling';
import type { DrizzleContext } from '../unit-of-work/drizzle-context.js';
import { jobsTable, type JobsTable } from './jobs-table.js';

type JobRow = JobsTable['$inferSelect'];

type Change = PgUpdateSetSource<JobsTable>;

/**
 * The background jobs in PostgreSQL. `add` runs on the executor of the context: inside a unit of
 * work, the job is written by the transaction of the command and shares its fate. Claims take
 * due rows `FOR UPDATE SKIP LOCKED` in a short transaction of their own.
 */
export class DrizzleJobStore<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown>,
  S extends TablesRelationalConfig,
> implements JobStore
{
  private readonly jobs: JobsTable;

  constructor(
    private readonly context: DrizzleContext<Q, F, S>,
    table?: JobsTable,
  ) {
    this.jobs = table ?? jobsTable();
  }

  async add(job: NewJob): Promise<EnqueuedJob> {
    const { jobs } = this;
    const executor = this.context.executor();
    const tenantId = tenantKeyOf(job.enqueuedBy);

    const inserted = await executor
      .insert(jobs)
      .values({ ...job, tenantId, idempotencyKey: job.idempotencyKey ?? null, subject: job.subject ?? null })
      .onConflictDoNothing({ target: [jobs.name, jobs.tenantId, jobs.idempotencyKey] })
      .returning({ id: jobs.id });

    if (inserted.length === 1 || job.idempotencyKey === undefined) {
      return { id: job.id, duplicate: false };
    }

    const [kept] = await executor
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.name, job.name), eq(jobs.tenantId, tenantId), eq(jobs.idempotencyKey, job.idempotencyKey)));

    return { id: kept?.id ?? job.id, duplicate: true };
  }

  claim({ queue, limit, now, leaseMs }: ClaimRequest): Promise<ClaimedJob[]> {
    const { jobs } = this;

    return this.context.executor().transaction(async (transaction) => {
      const due = await transaction
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.queue, queue), this.isDue(now)))
        .orderBy(jobs.runAt, jobs.sequence)
        .limit(Math.max(0, limit))
        .for('update', { skipLocked: true });

      if (due.length === 0) {
        return [];
      }

      const claimed = await transaction
        .update(jobs)
        .set({ status: 'running', attempts: sql`${jobs.attempts} + 1`, leaseUntil: new Date(now.getTime() + leaseMs) })
        .where(
          inArray(
            jobs.id,
            due.map(({ id }) => id),
          ),
        )
        .returning();

      // RETURNING gives no order guarantee: restore the one of the claim.
      return due.flatMap(({ id }) => claimed.filter((row) => row.id === id)).map(claimedOf);
    });
  }

  heartbeat(lease: JobLease, leaseUntil: Date): Promise<boolean> {
    return this.holding(lease, { leaseUntil });
  }

  update(lease: JobLease, update: JobUpdate, leaseUntil: Date): Promise<boolean> {
    return this.holding(lease, {
      leaseUntil,
      ...(update.progress === undefined ? {} : { progress: update.progress }),
      ...('checkpoint' in update ? { checkpoint: update.checkpoint ?? null } : {}),
    });
  }

  complete(lease: JobLease, at: Date): Promise<boolean> {
    return this.holding(lease, { status: 'succeeded', finishedAt: at, leaseUntil: null });
  }

  fail(lease: JobLease, { errorCode, retryAt, at }: JobFailure): Promise<boolean> {
    const next: Change =
      retryAt === null
        ? { status: 'dead', finishedAt: at, leaseUntil: null }
        : { status: 'waiting', runAt: retryAt, leaseUntil: null };

    return this.holding(lease, { ...next, lastErrorCode: errorCode });
  }

  release(lease: JobLease, runAt: Date): Promise<boolean> {
    return this.holding(lease, {
      status: 'waiting',
      runAt,
      leaseUntil: null,
      attempts: sql`${this.jobs.attempts} - 1`,
    });
  }

  async cancel(id: string, at: Date): Promise<boolean> {
    const { jobs } = this;

    const cancelled = await this.context
      .executor()
      .update(jobs)
      .set({ status: 'cancelled', finishedAt: at, leaseUntil: null })
      .where(and(eq(jobs.id, id), inArray(jobs.status, ['waiting', 'running'])))
      .returning({ id: jobs.id });

    return cancelled.length === 1;
  }

  async find(id: string): Promise<QueuedJob | undefined> {
    const [row] = await this.context.executor().select().from(this.jobs).where(eq(this.jobs.id, id));

    return row === undefined ? undefined : queuedOf(row);
  }

  async retryDead(ids: readonly string[], now: Date): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const { jobs } = this;

    const revived = await this.context
      .executor()
      .update(jobs)
      .set({ status: 'waiting', attempts: 0, runAt: now, finishedAt: null })
      .where(and(inArray(jobs.id, [...ids]), eq(jobs.status, 'dead')))
      .returning({ id: jobs.id });

    return revived.length;
  }

  async purgeFinished(before: Date): Promise<number> {
    const { jobs } = this;

    const purged = await this.context
      .executor()
      .delete(jobs)
      .where(and(inArray(jobs.status, ['succeeded', 'cancelled']), lt(jobs.finishedAt, before)))
      .returning({ id: jobs.id });

    return purged.length;
  }

  async stats(queue: string): Promise<JobStoreStats> {
    const { status } = this.jobs;

    // count() is a bigint, which some drivers return as a string.
    const counted = await this.context
      .executor()
      .select({ status, count: sql<number>`count(*)`.mapWith(Number) })
      .from(this.jobs)
      .where(eq(this.jobs.queue, queue))
      .groupBy(status);

    const of = (wanted: string) =>
      counted.filter((row) => row.status === wanted).reduce((sum, row) => sum + row.count, 0);

    return { waiting: of('waiting'), running: of('running'), dead: of('dead') };
  }

  private isDue(now: Date): SQL | undefined {
    const { jobs } = this;

    return or(
      and(eq(jobs.status, 'waiting'), lte(jobs.runAt, now)),
      and(eq(jobs.status, 'running'), lte(jobs.leaseUntil, now)),
    );
  }

  /** Changes the row only while this attempt holds it. */
  private async holding(lease: JobLease, change: Change): Promise<boolean> {
    const { jobs } = this;

    const changed = await this.context
      .executor()
      .update(jobs)
      .set(change)
      .where(and(eq(jobs.id, lease.id), eq(jobs.status, 'running'), eq(jobs.attempts, lease.attempt)))
      .returning({ id: jobs.id });

    return changed.length === 1;
  }
}

function claimedOf(row: JobRow): ClaimedJob {
  return {
    id: row.id,
    name: row.name,
    queue: row.queue,
    payload: row.payload,
    enqueuedBy: row.enqueuedBy,
    enqueuedAt: row.enqueuedAt,
    attempt: row.attempts,
    ...(row.checkpoint === null ? {} : { checkpoint: row.checkpoint }),
  };
}

function queuedOf(row: JobRow): QueuedJob {
  return {
    id: row.id,
    name: row.name,
    queue: row.queue,
    status: row.status,
    attempts: row.attempts,
    enqueuedAt: row.enqueuedAt,
    runAt: row.runAt,
    ...(row.tenantId === '' ? {} : { tenantId: row.tenantId }),
    ...(row.subject === null ? {} : { subject: row.subject }),
    ...(row.progress === null ? {} : { progress: row.progress }),
    ...(row.lastErrorCode === null ? {} : { lastErrorCode: row.lastErrorCode }),
    ...(row.finishedAt === null ? {} : { finishedAt: row.finishedAt }),
  };
}

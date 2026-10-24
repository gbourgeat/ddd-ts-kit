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
import { lockedIdOf } from '../outbox/locked-id-of';
import type { PrismaRawQueries } from '../outbox/prisma-raw-queries';
import type { PrismaUnitOfWork } from '../unit-of-work/create-prisma-unit-of-work';
import { checkpointText } from './checkpoint-text';
import { claimedOfRow } from './claimed-of-row';
import { dueJobsSelect } from './due-jobs-select';
import { jobOfRow } from './job-of-row';
import { jsonInputOf } from './json-input-of';
import type { PrismaJobDelegate, PrismaJobUpdate } from './prisma-job-delegate';

export interface PrismaJobStoreOptions<Tx> {
  /** How to reach the model of the background jobs from a client: `(client) => client.backgroundJob`. */
  readonly delegate: (client: Tx) => PrismaJobDelegate;
  /** The schema of the table, for the locking select of the claim. Default: that of the connection. */
  readonly schema?: string;
  /** The table the model is mapped to. Default `background_jobs`. */
  readonly table?: string;
}

/**
 * The background jobs in a PostgreSQL table, through Prisma Client. `add` runs on the client of
 * the unit of work: inside `run`, the job is written by the transaction of the command and shares
 * its fate. A claim selects the due rows `FOR UPDATE SKIP LOCKED`, the one raw statement of the
 * store, and leases them in a short transaction, so several workers pass over each other's rows
 * instead of waiting.
 */
export class PrismaJobStore<Tx extends PrismaRawQueries> implements JobStore {
  private readonly modelOf: (client: Tx) => PrismaJobDelegate;

  private readonly lockingSelect: string;

  constructor(
    private readonly unitOfWork: PrismaUnitOfWork<Tx>,
    options: PrismaJobStoreOptions<Tx>,
  ) {
    this.modelOf = options.delegate;
    this.lockingSelect = dueJobsSelect(options.schema, options.table ?? 'background_jobs');
  }

  async add(job: NewJob): Promise<EnqueuedJob> {
    const tenantId = tenantKeyOf(job.enqueuedBy);

    // INSERT ... ON CONFLICT DO NOTHING: a duplicate leaves the transaction of the command usable.
    const { count } = await this.jobs().createMany({
      data: [
        {
          id: job.id,
          name: job.name,
          queue: job.queue,
          // A JSON `null` payload is left out and stored as SQL NULL: a `Json` field refuses a bare null.
          ...(job.payload === null || job.payload === undefined ? {} : { payload: jsonInputOf(job.payload) }),
          enqueuedBy: jsonInputOf(job.enqueuedBy),
          idempotencyKey: job.idempotencyKey ?? null,
          tenantId,
          subject: job.subject ?? null,
          runAt: job.runAt,
          enqueuedAt: job.enqueuedAt,
        },
      ],
      skipDuplicates: true,
    });

    if (count === 1 || job.idempotencyKey === undefined) {
      return { id: job.id, duplicate: false };
    }

    const kept = await this.jobs().findFirst({
      where: { name: job.name, tenantId, idempotencyKey: job.idempotencyKey },
    });

    return { id: kept?.id ?? job.id, duplicate: true };
  }

  async claim({ queue, limit, now, leaseMs }: ClaimRequest): Promise<ClaimedJob[]> {
    if (limit <= 0) {
      return [];
    }

    return this.unitOfWork.run(async () => {
      const locked: unknown = await this.unitOfWork.client().$queryRawUnsafe(this.lockingSelect, queue, now, limit);
      const ids = Array.isArray(locked) ? locked.map(lockedIdOf) : [];

      if (ids.length === 0) {
        return [];
      }

      await this.jobs().updateMany({
        where: { id: { in: ids } },
        data: { status: 'running', attempts: { increment: 1 }, leaseUntil: new Date(now.getTime() + leaseMs) },
      });

      const order = new Map(ids.map((id, index) => [id, index]));
      const claimed = await this.jobs().findMany({ where: { id: { in: ids } } });

      // An `in` filter gives no order guarantee: restore the one of the claim.
      return claimed.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(claimedOfRow);
    });
  }

  heartbeat(lease: JobLease, leaseUntil: Date): Promise<boolean> {
    return this.holding(lease, { leaseUntil });
  }

  update(lease: JobLease, update: JobUpdate, leaseUntil: Date): Promise<boolean> {
    return this.holding(lease, {
      leaseUntil,
      ...(update.progress === undefined ? {} : { progress: jsonInputOf(update.progress) }),
      ...('checkpoint' in update ? { checkpoint: checkpointText(update.checkpoint) } : {}),
    });
  }

  complete(lease: JobLease, at: Date): Promise<boolean> {
    return this.holding(lease, { status: 'succeeded', finishedAt: at, leaseUntil: null });
  }

  fail(lease: JobLease, { errorCode, retryAt, at }: JobFailure): Promise<boolean> {
    const next: PrismaJobUpdate =
      retryAt === null
        ? { status: 'dead', finishedAt: at, leaseUntil: null }
        : { status: 'waiting', runAt: retryAt, leaseUntil: null };

    return this.holding(lease, { ...next, lastErrorCode: errorCode });
  }

  release(lease: JobLease, runAt: Date): Promise<boolean> {
    return this.holding(lease, { status: 'waiting', runAt, leaseUntil: null, attempts: { decrement: 1 } });
  }

  async cancel(id: string, at: Date): Promise<boolean> {
    const { count } = await this.jobs().updateMany({
      where: { id, status: { in: ['waiting', 'running'] } },
      data: { status: 'cancelled', finishedAt: at, leaseUntil: null },
    });

    return count === 1;
  }

  async find(id: string): Promise<QueuedJob | undefined> {
    const row = await this.jobs().findFirst({ where: { id } });

    return row === null ? undefined : jobOfRow(row);
  }

  async retryDead(ids: readonly string[], now: Date): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const { count } = await this.jobs().updateMany({
      where: { id: { in: [...ids] }, status: 'dead' },
      data: { status: 'waiting', attempts: 0, runAt: now, finishedAt: null },
    });

    return count;
  }

  async purgeFinished(before: Date): Promise<number> {
    const { count } = await this.jobs().deleteMany({
      where: { status: { in: ['succeeded', 'cancelled'] }, finishedAt: { lt: before } },
    });

    return count;
  }

  async stats(queue: string): Promise<JobStoreStats> {
    const jobs = this.jobs();
    // One after the other: a transaction client runs one query at a time anyway.
    const waiting = await jobs.count({ where: { queue, status: 'waiting' } });
    const running = await jobs.count({ where: { queue, status: 'running' } });
    const dead = await jobs.count({ where: { queue, status: 'dead' } });

    return { waiting, running, dead };
  }

  /** Changes the row only while this attempt holds it. */
  private async holding(lease: JobLease, data: PrismaJobUpdate): Promise<boolean> {
    const { count } = await this.jobs().updateMany({
      where: { id: lease.id, status: 'running', attempts: lease.attempt },
      data,
    });

    return count === 1;
  }

  private jobs(): PrismaJobDelegate {
    return this.modelOf(this.unitOfWork.client());
  }
}

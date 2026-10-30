import { In, LessThan, type EntityManager, type EntitySchema } from 'typeorm';
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
import { insertIgnoringConflict } from '../sql/insert-ignoring-conflict';
import type { TypeOrmContext } from '../unit-of-work/type-orm-context';
import { jobEntity } from './job-entity';
import type { JobRow } from './job-row';

export interface TypeOrmJobStoreOptions {
  /** Default `jobEntity()`, which must then be the one the data source registers. */
  readonly entity?: EntitySchema<JobRow>;
}

type Change = Parameters<EntityManager['update']>[2];

/**
 * The background jobs in a PostgreSQL table, through TypeORM. `add` runs on the manager of the
 * context: inside a unit of work, the job is written by the transaction of the command and shares
 * its fate. A claim takes the due rows `FOR UPDATE SKIP LOCKED` in a short transaction, so several
 * workers pass over each other's rows instead of waiting.
 */
export class TypeOrmJobStore implements JobStore {
  private readonly jobs: EntitySchema<JobRow>;

  constructor(
    private readonly context: TypeOrmContext,
    options: TypeOrmJobStoreOptions = {},
  ) {
    this.jobs = options.entity ?? jobEntity();
  }

  async add(job: NewJob): Promise<EnqueuedJob> {
    const manager = this.context.manager();
    const tenantId = tenantKeyOf(job.enqueuedBy);

    const inserted = await insertIgnoringConflict(manager, this.jobs, {
      id: job.id,
      name: job.name,
      queue: job.queue,
      // A JSON `null` payload is stored as SQL NULL, and read back as `null` all the same.
      payload: job.payload ?? null,
      enqueuedBy: job.enqueuedBy,
      idempotencyKey: job.idempotencyKey ?? null,
      tenantId,
      subject: job.subject ?? null,
      runAt: job.runAt,
      enqueuedAt: job.enqueuedAt,
    });

    if (inserted || job.idempotencyKey === undefined) {
      return { id: job.id, duplicate: false };
    }

    const kept = await manager.findOneBy(this.jobs, {
      name: job.name,
      tenantId,
      idempotencyKey: job.idempotencyKey,
    });

    return { id: kept?.id ?? job.id, duplicate: true };
  }

  async claim({ queue, limit, now, leaseMs }: ClaimRequest): Promise<ClaimedJob[]> {
    if (limit <= 0) {
      return [];
    }

    return this.context.manager().transaction(async (transaction) => {
      const due = await transaction
        .createQueryBuilder(this.jobs, 'job')
        .where('job.queue = :queue', { queue })
        .andWhere(
          "((job.status = 'waiting' and job.runAt <= :now) or (job.status = 'running' and job.leaseUntil <= :now))",
          { now },
        )
        .orderBy('job.runAt', 'ASC')
        .addOrderBy('job.sequence', 'ASC')
        .limit(limit)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      if (due.length > 0) {
        await transaction.update(
          this.jobs,
          { id: In(due.map((row) => row.id)) },
          { status: 'running', attempts: () => 'attempts + 1', leaseUntil: new Date(now.getTime() + leaseMs) },
        );
      }

      return due.map(claimedOf);
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
    return this.holding(lease, { status: 'waiting', runAt, leaseUntil: null, attempts: () => 'attempts - 1' });
  }

  async cancel(id: string, at: Date): Promise<boolean> {
    const cancelled = await this.context
      .manager()
      .update(
        this.jobs,
        { id, status: In(['waiting', 'running']) },
        { status: 'cancelled', finishedAt: at, leaseUntil: null },
      );

    return cancelled.affected === 1;
  }

  async find(id: string): Promise<QueuedJob | undefined> {
    const row = await this.context.manager().findOneBy(this.jobs, { id });

    return row === null ? undefined : queuedOf(row);
  }

  async retryDead(ids: readonly string[], now: Date): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const revived = await this.context
      .manager()
      .update(
        this.jobs,
        { id: In([...ids]), status: 'dead' },
        { status: 'waiting', attempts: 0, runAt: now, finishedAt: null },
      );

    return revived.affected ?? 0;
  }

  async purgeFinished(before: Date): Promise<number> {
    const purged = await this.context
      .manager()
      .delete(this.jobs, { status: In(['succeeded', 'cancelled']), finishedAt: LessThan(before) });

    return purged.affected ?? 0;
  }

  async eraseSubject(subject: string): Promise<number> {
    const erased = await this.context.manager().delete(this.jobs, { subject });

    return erased.affected ?? 0;
  }

  async stats(queue: string): Promise<JobStoreStats> {
    // Portable form of `count(*) filter (where ...)`.
    const count = (status: string): string => `SUM(CASE WHEN job.status = '${status}' THEN 1 ELSE 0 END)`;

    const row = await this.context
      .manager()
      .createQueryBuilder(this.jobs, 'job')
      .select(count('waiting'), 'waiting')
      .addSelect(count('running'), 'running')
      .addSelect(count('dead'), 'dead')
      .where('job.queue = :queue', { queue })
      .getRawOne<{ waiting: unknown; running: unknown; dead: unknown }>();

    // A sum is a bigint, which drivers return as a string, and NULL over no row.
    return { waiting: Number(row?.waiting ?? 0), running: Number(row?.running ?? 0), dead: Number(row?.dead ?? 0) };
  }

  /** Changes the row only while this attempt holds it. */
  private async holding(lease: JobLease, change: Change): Promise<boolean> {
    const changed = await this.context
      .manager()
      .update(this.jobs, { id: lease.id, status: 'running', attempts: lease.attempt }, change);

    return changed.affected === 1;
  }
}

/** A row as the worker receives it, the attempt of this claim counted. */
function claimedOf(row: JobRow): ClaimedJob {
  return {
    id: row.id,
    name: row.name,
    queue: row.queue,
    payload: row.payload,
    enqueuedBy: row.enqueuedBy,
    enqueuedAt: row.enqueuedAt,
    attempt: row.attempts + 1,
    ...(row.checkpoint === null ? {} : { checkpoint: row.checkpoint }),
  };
}

/** What a row of the table shows of its job: never the payload, the checkpoint or the actor. */
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

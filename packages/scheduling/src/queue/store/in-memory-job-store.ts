import { whenCommitted, type EnqueuedJob, type QueuedJob } from '@ddd-ts-kit/kernel';
import type { ClaimRequest } from './claim-request';
import type { ClaimedJob } from './claimed-job';
import type { JobFailure } from './job-failure';
import type { JobLease } from './job-lease';
import type { JobStoreStats } from './job-store-stats';
import type { JobStore } from './job-store';
import type { JobUpdate } from './job-update';
import type { NewJob } from './new-job';
import { plainJson } from './plain-json';
import { queuedJobOf } from './queued-job-of';
import type { StoredJob } from './stored-job';

const FINISHED: readonly string[] = ['succeeded', 'cancelled'];

/**
 * The queue in the memory of the process, for tests and a single process without a database.
 * Called inside a unit of work, `add`, `cancel` and `retryDead` answer from what the store holds
 * and write once it committed (`whenCommitted`): a command that rolls back leaves no job and
 * cancels none. Payloads and checkpoints go through JSON, as in every other store.
 */
export class InMemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, StoredJob>();

  private sequence = 0;

  async add(job: NewJob): Promise<EnqueuedJob> {
    const existing = this.withKey(job);

    if (existing !== undefined) {
      return { id: existing.id, duplicate: true };
    }

    await whenCommitted(async () => {
      this.store(job);
    });

    return { id: job.id, duplicate: false };
  }

  async claim({ queue, limit, now, leaseMs }: ClaimRequest): Promise<ClaimedJob[]> {
    const due = [...this.jobs.values()]
      .filter((job) => job.queue === queue && isDue(job, now))
      .sort((left, right) => left.runAt.getTime() - right.runAt.getTime() || left.sequence - right.sequence)
      .slice(0, Math.max(0, limit));

    for (const job of due) {
      job.status = 'running';
      job.attempts += 1;
      job.leaseUntil = new Date(now.getTime() + leaseMs);
    }

    return due.map(claimedOf);
  }

  async heartbeat(lease: JobLease, leaseUntil: Date): Promise<boolean> {
    return this.holding(lease, (job) => {
      job.leaseUntil = leaseUntil;
    });
  }

  async update(lease: JobLease, update: JobUpdate, leaseUntil: Date): Promise<boolean> {
    return this.holding(lease, (job) => {
      job.leaseUntil = leaseUntil;
      job.progress = update.progress ?? job.progress;
      job.checkpoint = 'checkpoint' in update ? plainJson(update.checkpoint) : job.checkpoint;
    });
  }

  async complete(lease: JobLease, at: Date): Promise<boolean> {
    return this.holding(lease, (job) => {
      finish(job, 'succeeded', at);
    });
  }

  async fail(lease: JobLease, { errorCode, retryAt, at }: JobFailure): Promise<boolean> {
    return this.holding(lease, (job) => {
      job.lastErrorCode = errorCode;

      if (retryAt === null) {
        finish(job, 'dead', at);
      } else {
        job.status = 'waiting';
        job.runAt = retryAt;
        job.leaseUntil = undefined;
      }
    });
  }

  async release(lease: JobLease, runAt: Date): Promise<boolean> {
    return this.holding(lease, (job) => {
      job.status = 'waiting';
      job.attempts -= 1;
      job.runAt = runAt;
      job.leaseUntil = undefined;
    });
  }

  async cancel(id: string, at: Date): Promise<boolean> {
    if (!isCancellable(this.jobs.get(id))) {
      return false;
    }

    await whenCommitted(async () => {
      const job = this.jobs.get(id);

      if (isCancellable(job)) {
        finish(job, 'cancelled', at);
      }
    });

    return true;
  }

  async find(id: string): Promise<QueuedJob | undefined> {
    const job = this.jobs.get(id);

    return job === undefined ? undefined : queuedJobOf(job);
  }

  async retryDead(ids: readonly string[], now: Date): Promise<number> {
    const dead = this.dead(ids);

    await whenCommitted(async () => {
      for (const job of this.dead(ids)) {
        Object.assign(job, { status: 'waiting', attempts: 0, runAt: now, finishedAt: undefined });
      }
    });

    return dead.length;
  }

  async purgeFinished(before: Date): Promise<number> {
    const purged = [...this.jobs.values()].filter(
      (job) => FINISHED.includes(job.status) && job.finishedAt !== undefined && job.finishedAt < before,
    );

    for (const job of purged) {
      this.jobs.delete(job.id);
    }

    return purged.length;
  }

  async eraseSubject(subject: string): Promise<number> {
    const held = [...this.jobs.values()].filter((job) => job.subject === subject);

    await whenCommitted(async () => {
      for (const job of held) {
        this.jobs.delete(job.id);
      }
    });

    return held.length;
  }

  async stats(queue: string): Promise<JobStoreStats> {
    const jobs = [...this.jobs.values()].filter((job) => job.queue === queue);
    const counted = (status: string) => jobs.filter((job) => job.status === status).length;

    return { waiting: counted('waiting'), running: counted('running'), dead: counted('dead') };
  }

  /** Every job in the order it was added, as the queue shows it: for assertions. */
  list(): QueuedJob[] {
    return [...this.jobs.values()].map(queuedJobOf);
  }

  private dead(ids: readonly string[]): StoredJob[] {
    return ids.flatMap((id) => {
      const job = this.jobs.get(id);

      return job?.status === 'dead' ? [job] : [];
    });
  }

  /** The key is scoped by the tenant: two tenants never share one. */
  private withKey({ name, idempotencyKey, enqueuedBy }: NewJob): StoredJob | undefined {
    if (idempotencyKey === undefined) {
      return undefined;
    }

    return [...this.jobs.values()].find(
      (job) =>
        job.name === name && job.idempotencyKey === idempotencyKey && job.enqueuedBy.tenantId === enqueuedBy.tenantId,
    );
  }

  /** A job of the same key may have committed while this one waited for its own commit. */
  private store(job: NewJob): void {
    if (this.withKey(job) !== undefined) {
      return;
    }

    this.sequence += 1;

    this.jobs.set(job.id, {
      ...job,
      payload: plainJson(job.payload),
      enqueuedBy: structuredClone(job.enqueuedBy),
      idempotencyKey: job.idempotencyKey,
      subject: job.subject,
      sequence: this.sequence,
      status: 'waiting',
      attempts: 0,
      leaseUntil: undefined,
      progress: undefined,
      checkpoint: undefined,
      lastErrorCode: undefined,
      finishedAt: undefined,
    });
  }

  private holding(lease: JobLease, change: (job: StoredJob) => void): boolean {
    const job = this.jobs.get(lease.id);

    if (job?.status !== 'running' || job.attempts !== lease.attempt) {
      return false;
    }

    change(job);

    return true;
  }
}

function isCancellable(job: StoredJob | undefined): job is StoredJob {
  return job?.status === 'waiting' || job?.status === 'running';
}

function isDue(job: StoredJob, now: Date): boolean {
  if (job.status === 'waiting') {
    return job.runAt <= now;
  }

  return job.status === 'running' && job.leaseUntil !== undefined && job.leaseUntil <= now;
}

function finish(job: StoredJob, status: 'succeeded' | 'cancelled' | 'dead', at: Date): void {
  job.status = status;
  job.finishedAt = at;
  job.leaseUntil = undefined;
}

function claimedOf(job: StoredJob): ClaimedJob {
  return {
    id: job.id,
    name: job.name,
    queue: job.queue,
    payload: plainJson(job.payload),
    enqueuedBy: structuredClone(job.enqueuedBy),
    enqueuedAt: job.enqueuedAt,
    attempt: job.attempts,
    ...(job.checkpoint === undefined ? {} : { checkpoint: plainJson(job.checkpoint) }),
  };
}

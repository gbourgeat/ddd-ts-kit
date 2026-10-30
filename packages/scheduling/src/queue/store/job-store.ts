import type { EnqueuedJob, QueuedJob } from '@ddd-ts-kit/kernel';
import type { ClaimRequest } from './claim-request';
import type { ClaimedJob } from './claimed-job';
import type { JobFailure } from './job-failure';
import type { JobLease } from './job-lease';
import type { JobStoreStats } from './job-store-stats';
import type { JobUpdate } from './job-update';
import type { NewJob } from './new-job';

/**
 * Where background jobs wait between `enqueue` and their run, and what a worker reports of them.
 *
 * A claim is a lease: a job claimed and not heard of before its lease ends is claimed again,
 * which is how the jobs of a worker that died come back. Every report names the attempt it
 * holds (`JobLease`): once the job was claimed again, or cancelled, the store answers false and
 * the worker stops. Every write answers false when it changed nothing.
 */
export abstract class JobStore {
  static readonly tokenKey = 'scheduling.JobStore';

  /**
   * Adds the job, in the transaction of the caller when the store is transactional. A job of the
   * same name, tenant and idempotency key already kept is answered instead, `duplicate: true`.
   * A store that writes after the commit checks the key before: two jobs of one key staged
   * before either committed both answer their own id, and only the first is kept.
   */
  abstract add(job: NewJob): Promise<EnqueuedJob>;

  /**
   * Claims up to `limit` jobs of the queue that are due (waiting with `runAt` passed, or running
   * with an expired lease), the earliest first, and counts the attempt. Two concurrent claims
   * never return the same job.
   */
  abstract claim(request: ClaimRequest): Promise<ClaimedJob[]>;

  /** Extends the lease while the run goes on. False: the job was cancelled or claimed again. */
  abstract heartbeat(lease: JobLease, leaseUntil: Date): Promise<boolean>;

  /** Stores the progress or the checkpoint of the run, and extends the lease. */
  abstract update(lease: JobLease, update: JobUpdate, leaseUntil: Date): Promise<boolean>;

  abstract complete(lease: JobLease, at: Date): Promise<boolean>;

  /** Schedules the next attempt, or declares the job dead when `retryAt` is null. */
  abstract fail(lease: JobLease, failure: JobFailure): Promise<boolean>;

  /** Gives a job back without counting the attempt: the worker stops before the run could end. */
  abstract release(lease: JobLease, runAt: Date): Promise<boolean>;

  /**
   * A waiting or running job is cancelled: a running one learns it at its next heartbeat. In
   * the transaction of the caller, or once it committed for a store that cannot share it.
   */
  abstract cancel(id: string, at: Date): Promise<boolean>;

  abstract find(id: string): Promise<QueuedJob | undefined>;

  /** Puts dead jobs back with a fresh attempt budget. Answers how many. */
  abstract retryDead(ids: readonly string[], now: Date): Promise<number>;

  /** Housekeeping: drops the jobs that succeeded or were cancelled before `before`. Dead jobs stay. */
  abstract purgeFinished(before: Date): Promise<number>;

  /**
   * The right to erasure: drops every job enqueued with this `subject`, whatever its status, payload
   * and checkpoint with it. A waiting job never runs, a dead one is never put back, a running one
   * learns it at its next heartbeat. Answers how many, none the second time. In the transaction of
   * the caller, or once it committed for a store that cannot share it.
   */
  abstract eraseSubject(subject: string): Promise<number>;

  abstract stats(queue: string): Promise<JobStoreStats>;
}

import type { BackgroundJobType } from '../background/background-job-type';
import type { EnqueueOptions } from '../background/enqueue-options';
import type { EnqueuedJob } from '../background/enqueued-job';
import type { QueuedJob } from '../background/queued-job';

/**
 * Hands work to a worker. Called inside the unit of work of a command, the job is added with
 * the business change: a command that rolls back leaves no job, and one that commits loses none
 * (a queue sharing the transaction, such as the jobs table of the ORM packages; a queue that
 * cannot share it, such as Redis, adds the job once the transaction committed and says what it
 * risks). A cancellation inside a unit of work shares its fate the same way.
 *
 * Work done for a tenant only sees and cancels the jobs of that tenant (an elevation, the
 * tenants it names); work without a tenant sees every job.
 */
export abstract class JobQueue {
  static {
    Object.defineProperty(this, 'tokenKey', { value: 'kernel.JobQueue' });
  }

  /** The payload is plain JSON data: a date travels as its ISO text. */
  abstract enqueue<Payload>(
    job: BackgroundJobType<Payload>,
    payload: NoInfer<Payload>,
    options?: EnqueueOptions,
  ): Promise<EnqueuedJob>;

  /**
   * Answers false when the job is unknown, out of reach or already over. A running job sees its
   * signal aborted at its next heartbeat.
   */
  abstract cancel(id: string): Promise<boolean>;

  /** Where a job stands: status, attempts, progress. Undefined when unknown or out of reach. */
  abstract find(id: string): Promise<QueuedJob | undefined>;
}

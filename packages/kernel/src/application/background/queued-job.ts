import type { JobProgress } from './job-progress.js';
import type { QueuedJobStatus } from './queued-job-status.js';

/** A background job as the queue holds it, for a screen or an operator. Never its payload. */
export interface QueuedJob {
  readonly id: string;
  readonly name: string;
  /** The context the job belongs to: the first part of its name. */
  readonly queue: string;
  readonly status: QueuedJobStatus;
  /** Attempts started, the one in progress included. */
  readonly attempts: number;
  readonly enqueuedAt: Date;
  /** Not claimed before this instant. */
  readonly runAt: Date;
  /** The tenant of the work that enqueued it, when that work had one. */
  readonly tenantId?: string;
  /** What the job works on, as `enqueue` named it (`EnqueueOptions.subject`). */
  readonly subject?: string;
  readonly progress?: JobProgress;
  /** The `code` of the last failure, never a message. */
  readonly lastErrorCode?: string;
  /** When it succeeded, was cancelled or died. */
  readonly finishedAt?: Date;
}

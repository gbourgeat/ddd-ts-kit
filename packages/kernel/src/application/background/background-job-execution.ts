import type { JobProgress } from './job-progress.js';

/** What a run of a background job is told about itself, and how it reports back. */
export interface BackgroundJobExecution {
  /** The id `enqueue` answered: the same for every attempt. */
  readonly jobId: string;
  /** 1 for the first run, counted at each claim: a retry, a crash or an expired lease adds one. */
  readonly attempt: number;
  readonly enqueuedAt: Date;
  readonly startedAt: Date;
  /** What the last `saveCheckpoint` of an earlier attempt stored, to resume from. Absent on a fresh start. */
  readonly checkpoint: unknown;
  /**
   * Aborted when the run exceeds its timeout, the job is cancelled, its lease is lost to another
   * worker, or the worker stops: a long job checks it between two steps and passes it on.
   */
  readonly signal: AbortSignal;
  /** The W3C `traceparent` of the work that enqueued the job, which the run continues when tracing is on. */
  readonly traceparent?: string;
  /** Stores how far the work went, plain JSON, so that the next attempt resumes there. Extends the lease. */
  saveCheckpoint(checkpoint: unknown): Promise<void>;
  /** Stores the progress a screen may show. Extends the lease. */
  reportProgress(progress: JobProgress): Promise<void>;
}

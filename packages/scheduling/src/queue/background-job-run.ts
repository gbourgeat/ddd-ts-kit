import type { BackgroundJobOutcome } from './background-job-outcome.js';

/** One attempt of a background job and what became of it, as data. Never a payload, never a message. */
export interface BackgroundJobRun {
  readonly job: string;
  readonly jobId: string;
  readonly attempt: number;
  readonly outcome: BackgroundJobOutcome;
  readonly startedAt: Date;
  readonly durationMs: number;
  /** The `code` of what the run threw, or `UNEXPECTED_ERROR`. */
  readonly errorCode?: string;
  /** The correlation of the work that enqueued the job. */
  readonly correlationId: string;
}

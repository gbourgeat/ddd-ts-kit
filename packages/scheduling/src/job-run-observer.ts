import type { JobRun } from '@ddd-ts-kit/kernel';

/** What the run carried that its `JobRun` does not say. */
export interface JobRunDetail {
  /** The correlation id of the execution context the job ran in. Absent when it never started. */
  readonly correlationId?: string;
}

/** Told of every occurrence handled, with what the job threw when it failed: for an error tracker, or a test. */
export type JobRunObserver = (run: JobRun, error?: unknown, detail?: JobRunDetail) => void;

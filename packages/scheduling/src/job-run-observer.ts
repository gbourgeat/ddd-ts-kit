import type { JobRun } from '@ddd-ts-kit/kernel';

/** Told of every occurrence handled, with what the job threw when it failed: for an error tracker, or a test. */
export type JobRunObserver = (run: JobRun, error?: unknown) => void;

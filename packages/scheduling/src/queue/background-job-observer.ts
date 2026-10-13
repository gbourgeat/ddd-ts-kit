import type { BackgroundJobRun } from './background-job-run.js';

/** Told of every attempt, with what the run threw when it failed: for an error tracker, or a test. */
export type BackgroundJobObserver = (run: BackgroundJobRun, error?: unknown) => void;

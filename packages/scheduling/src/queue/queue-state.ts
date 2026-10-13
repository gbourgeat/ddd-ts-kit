import type { BackgroundJobRun } from './background-job-run.js';

/** What a worker follows of one queue. */
export interface QueueState {
  readonly name: string;
  readonly concurrency: number;
  /** The attempts in progress. */
  readonly active: Set<Promise<BackgroundJobRun>>;
  pumping: boolean;
  cancelSleep: (() => void) | undefined;
}

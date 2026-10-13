import type { BackgroundJobRun } from './background-job-run.js';

/** What a worker follows of one queue. */
export interface QueueState {
  readonly name: string;
  readonly concurrency: number;
  /** The attempts in progress. */
  readonly active: Set<Promise<BackgroundJobRun>>;
  /** The claim in progress and the launch of what it claimed, which `stop` waits for. */
  filling: Promise<void> | undefined;
  cancelSleep: (() => void) | undefined;
}

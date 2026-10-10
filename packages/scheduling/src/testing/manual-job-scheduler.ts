import type { FixedClock, JobRun } from '@ddd-ts-kit/kernel';
import { InProcessJobScheduler, type InProcessJobSchedulerOptions } from '../in-process-job-scheduler.js';
import { ManualJobTimers } from './manual-job-timers.js';

export interface ManualJobSchedulerOptions extends Omit<InProcessJobSchedulerOptions, 'timers' | 'clock' | 'random'> {
  /** The clock `advance` moves. */
  readonly clock: FixedClock;
}

/**
 * The in-process scheduler on manual timers, without jitter: a test registers jobs, starts it,
 * advances time and reads `runs`, or runs one job with `runNow`.
 */
export class ManualJobScheduler extends InProcessJobScheduler {
  /** Every occurrence handled, in order, whatever became of it. */
  readonly runs: JobRun[];

  /** What the failed runs threw, in order. */
  readonly failures: unknown[];

  readonly timers: ManualJobTimers;

  constructor(options: ManualJobSchedulerOptions) {
    const timers = new ManualJobTimers(options.clock);
    const runs: JobRun[] = [];
    const failures: unknown[] = [];

    super({
      ...options,
      timers,
      random: () => 0,
      onRun: (run, error, detail) => {
        runs.push(run);

        if (run.outcome === 'failed') {
          failures.push(error);
        }

        options.onRun?.(run, error, detail);
      },
    });

    this.timers = timers;
    this.runs = runs;
    this.failures = failures;
  }

  /** See `ManualJobTimers.advance`. */
  advance(durationMs: number): Promise<void> {
    return this.timers.advance(durationMs);
  }

  /** The runs of one job, in order. */
  runsOf(job: string): JobRun[] {
    return this.runs.filter((run) => run.job === job);
  }
}

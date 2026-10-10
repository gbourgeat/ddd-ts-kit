import type { FixedClock, JobRun } from '@ddd-ts-kit/kernel';
import { InProcessJobScheduler, type InProcessJobSchedulerOptions } from './in-process-job-scheduler.js';
import type { JobTimers } from './timers.js';

interface Sleeping {
  readonly dueAt: number;
  readonly task: () => void;
}

/**
 * Timers that only move when a test says so, on the clock the scheduler reads: `advance(ms)`
 * fires what becomes due, in order, each at its instant.
 */
export class ManualJobTimers implements JobTimers {
  #sleeping: Sleeping[] = [];

  constructor(private readonly clock: FixedClock) {}

  /** Timers neither fired nor cancelled. */
  get pending(): number {
    return this.#sleeping.length;
  }

  schedule(delayMs: number, task: () => void): () => void {
    const sleeping = { dueAt: this.clock.now().getTime() + delayMs, task };
    this.#sleeping.push(sleeping);
    return () => {
      this.#sleeping = this.#sleeping.filter((other) => other !== sleeping);
    };
  }

  /**
   * Moves the clock forward, firing each timer at its instant and letting what it started go as
   * far as promises alone take it: a job that waits on nothing else has ended when this resolves,
   * a job blocked by the test is still running.
   */
  async advance(durationMs: number): Promise<void> {
    const target = this.clock.now().getTime() + durationMs;
    await settled();
    for (let next = this.#nextDue(target); next !== undefined; next = this.#nextDue(target)) {
      this.#sleeping = this.#sleeping.filter((other) => other !== next);
      this.#moveTo(next.dueAt);
      next.task();
      await settled();
    }
    this.#moveTo(target);
  }

  #nextDue(target: number): Sleeping | undefined {
    const [earliest] = this.#sleeping.filter(({ dueAt }) => dueAt <= target).sort((left, right) => left.dueAt - right.dueAt);
    return earliest;
  }

  #moveTo(instant: number): void {
    this.clock.advance(Math.max(0, instant - this.clock.now().getTime()));
  }
}

/** One turn of the event loop: every promise that depends on promises alone has settled. Not a wait in time. */
function settled(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

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
      onRun: (run, error) => {
        runs.push(run);
        if (run.outcome === 'failed') failures.push(error);
        options.onRun?.(run, error);
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

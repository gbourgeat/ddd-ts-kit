import type { JobDefinition } from '../scheduling/job-definition.js';
import type { JobDescription } from '../scheduling/job-description.js';
import type { JobRun } from '../scheduling/job-run.js';

/**
 * Runs jobs when they are due. Not the timer of `@ddd-ts-kit/aspects`: this one knows jobs,
 * schedules and instances. A failing job stops neither the scheduler nor the other jobs.
 */
export abstract class JobScheduler {
  static readonly tokenKey = 'kernel.JobScheduler';

  /** Throws `DuplicateJobError` for a name already registered, `InvalidJobScheduleError` for a schedule it cannot read. */
  abstract register(job: JobDefinition): void;

  /** Starts running the enabled jobs by time. Starting twice does nothing. */
  abstract start(): Promise<void>;

  /** Stops starting runs, waits for those in progress up to a grace period, then aborts them through their signal. */
  abstract stop(): Promise<void>;

  /**
   * Runs a job at once, enabled or not, for an operation or a test, and answers what became of
   * it. A job that fails answers `failed`: only an unknown name rejects, with `UnknownJobError`.
   */
  abstract runNow(name: string): Promise<JobRun>;

  abstract describe(): readonly JobDescription[];
}

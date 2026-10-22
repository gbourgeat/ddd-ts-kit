import type { JobRun } from './job-run';

export interface JobDescription {
  readonly name: string;
  /** `every 15m`, `cron 0 7 * * 1-5 (Europe/Paris)`. */
  readonly schedule: string;
  readonly enabled: boolean;
  readonly running: boolean;
  /** Absent for a disabled job and for a scheduler that is not started. */
  readonly nextRunAt?: Date;
  /** The last occurrence this instance handled, whatever became of it. */
  readonly lastRun?: JobRun;
}

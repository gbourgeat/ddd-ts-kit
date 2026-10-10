import type { JobSettings } from '@ddd-ts-kit/kernel';

export interface JobsOptions {
  /**
   * `false`: the jobs are registered, described and run on demand with `runNow`, and
   * `start()` never starts the scheduler. For the process that serves requests next to a worker
   * that runs the jobs. Default `true`.
   */
  readonly start?: boolean;
  /**
   * What configuration changes of a declared job, by job name: `enabled`, the schedule, any
   * option. A name no module declares is refused, so a renamed job cannot stay switched on by a
   * stale key.
   */
  readonly settings?: Readonly<Record<string, JobSettings>>;
}

import type { JobOptions } from './job-options';
import type { JobSchedule } from './job-schedule';

/** What a configuration may change of a declared job, without a code change. */
export interface JobSettings extends JobOptions {
  readonly schedule?: JobSchedule;
}

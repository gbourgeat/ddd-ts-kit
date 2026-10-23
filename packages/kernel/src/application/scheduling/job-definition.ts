import type { JobExecution } from './job-execution';
import type { JobOptions } from './job-options';
import type { JobSchedule } from './job-schedule';

/** A job as a scheduler receives it. */
export interface JobDefinition extends JobOptions {
  /** `<context>.<job-name>`, unique in the application. */
  readonly name: string;
  readonly schedule: JobSchedule;
  readonly run: (execution: JobExecution) => Promise<void>;
}

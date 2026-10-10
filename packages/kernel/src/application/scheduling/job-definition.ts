import type { JobExecution } from './job-execution.js';
import type { JobOptions } from './job-options.js';
import type { JobSchedule } from './job-schedule.js';

/** A job as a scheduler receives it. */
export interface JobDefinition extends JobOptions {
  /** `<context>.<job-name>`, unique in the application. */
  readonly name: string;
  readonly schedule: JobSchedule;
  readonly run: (execution: JobExecution) => Promise<void>;
}

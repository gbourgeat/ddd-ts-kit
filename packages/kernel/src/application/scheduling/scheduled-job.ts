import type { JobExecution } from './job-execution';

/**
 * A class of `application/scheduling/`. A job decides nothing: it triggers use cases, typically
 * by sending one command, and the business rules stay where they are.
 */
export interface ScheduledJob {
  run(execution: JobExecution): Promise<void>;
}

import type { JobRun } from '@ddd-ts-kit/kernel';
import type { ManualJobScheduler } from '@ddd-ts-kit/scheduling/testing';

export interface TestJobs {
  /**
   * Runs a job now, as the scheduler would (execution scope of origin `schedule`, system actor
   * of the job), and answers what became of it. Unlike the port, it throws what the job threw:
   * a spec wants the failure, not its code.
   */
  runNow(name: string): Promise<JobRun>;

  /**
   * On `clock`, not started: for a spec about time itself, `await jobs.scheduler.start()` then
   * `await jobs.scheduler.advance(ms)`, and `jobs.scheduler.runs` lists what happened.
   */
  readonly scheduler: ManualJobScheduler;
}

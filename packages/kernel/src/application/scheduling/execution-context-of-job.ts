import { systemActor } from '../actor/system-actor.js';
import { type ExecutionContext, executionContext } from '../execution/execution-context.js';

export interface JobExecutionStart {
  readonly correlationId: string;
  readonly scheduledAt: Date;
  /** The instant the timeout of the job ends the run, when it has one. */
  readonly deadline?: Date;
}

/**
 * The execution context of one run: origin `schedule`, the system actor named after the job, a
 * correlation of its own and the instant the run was due.
 */
export function executionContextOfJob(job: string, start: JobExecutionStart): ExecutionContext {
  return executionContext({ ...start, actor: systemActor(job), origin: 'schedule' });
}

import { systemActor } from '../actor/system-actor.js';
import { type ExecutionContext, executionContext } from '../execution/execution-context.js';

export interface JobExecutionStart {
  readonly correlationId: string;
  readonly scheduledAt: Date;
  /** The instant the timeout of the job ends the run, when it has one. */
  readonly deadline?: Date;
  /** For a job declared `tenancy: 'per-tenant'`: the tenant of this run. */
  readonly tenantId?: string;
}

/**
 * The execution context of one run: origin `schedule`, the system actor named after the job, a
 * correlation of its own, the instant the run was due, and the tenant of a per-tenant run.
 */
export function executionContextOfJob(job: string, start: JobExecutionStart): ExecutionContext {
  return executionContext({ ...start, actor: systemActor(job), origin: 'schedule' });
}

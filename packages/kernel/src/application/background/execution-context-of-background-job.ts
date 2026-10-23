import { type ExecutionContext, executionContext } from '../execution/execution-context';
import type { EnqueuedBy } from './enqueued-by';

export interface BackgroundJobStart {
  readonly jobId: string;
  readonly enqueuedBy: EnqueuedBy;
  /** The instant the timeout of the job ends the run, when it has one. */
  readonly deadline?: Date;
}

/**
 * The execution context of one run: origin `queue`, the correlation, the actor and the tenant of
 * the work that enqueued the job, and the job as the direct cause.
 */
export function executionContextOfBackgroundJob(start: BackgroundJobStart): ExecutionContext {
  const { jobId, enqueuedBy, deadline } = start;
  const { correlationId, actor, tenantId } = enqueuedBy;

  return executionContext({
    correlationId,
    causationId: jobId,
    actor,
    origin: 'queue',
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(deadline === undefined ? {} : { deadline }),
  });
}

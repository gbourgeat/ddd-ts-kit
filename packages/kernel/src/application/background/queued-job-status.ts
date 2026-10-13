/**
 * Where a background job stands, as a closed vocabulary a project can publish in its contract
 * (`@IsIn(Object.values(QueuedJobStatus))`):
 *
 * - `waiting`: due at `runAt`, or later after a failure.
 * - `running`: claimed by a worker, whose lease ends at `leaseUntil`.
 * - `succeeded`, `cancelled`: over.
 * - `dead`: every attempt failed; kept until an operator retries it.
 */
export const QueuedJobStatus = {
  Waiting: 'waiting',
  Running: 'running',
  Succeeded: 'succeeded',
  Cancelled: 'cancelled',
  Dead: 'dead',
} as const;

export type QueuedJobStatus = (typeof QueuedJobStatus)[keyof typeof QueuedJobStatus];

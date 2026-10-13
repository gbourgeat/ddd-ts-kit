/**
 * - `waiting`: due at `runAt`, or later after a failure.
 * - `running`: claimed by a worker, whose lease ends at `leaseUntil`.
 * - `succeeded`, `cancelled`: over.
 * - `dead`: every attempt failed; kept until an operator retries it.
 */
export type QueuedJobStatus = 'waiting' | 'running' | 'succeeded' | 'cancelled' | 'dead';

/**
 * - `succeeded`: the run ended and the job is over.
 * - `retried`: the run failed and the job waits for its next attempt.
 * - `dead`: the run failed and no attempt is left.
 * - `released`: the worker stopped before the run ended; the job waits again, the attempt not counted.
 * - `interrupted`: the job was cancelled, or another worker claimed it, while it ran.
 */
export type BackgroundJobOutcome = 'succeeded' | 'retried' | 'dead' | 'released' | 'interrupted';

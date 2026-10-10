/**
 * - `succeeded`, `failed`: the job ran.
 * - `skipped-overlap`: the previous run was still in progress.
 * - `skipped-locked`: another instance holds the occurrence.
 * - `missed`: the occurrence passed and was not run.
 */
export type JobOutcome = 'succeeded' | 'failed' | 'skipped-overlap' | 'skipped-locked' | 'missed';

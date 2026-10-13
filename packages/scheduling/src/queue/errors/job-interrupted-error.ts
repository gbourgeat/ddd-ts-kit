/** The store no longer gives this run the job: it was cancelled, or its lease expired and another worker claimed it. */
export class JobInterruptedError extends Error {
  readonly code = 'JOB_INTERRUPTED';

  constructor(job: string) {
    super(`Background job "${job}" was cancelled or claimed by another worker: this run stops.`);
    this.name = 'JobInterruptedError';
  }
}

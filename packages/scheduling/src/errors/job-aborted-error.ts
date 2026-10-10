/** The scheduler stopped and the run outlived the grace period. It is the reason of the aborted signal. */
export class JobAbortedError extends Error {
  readonly code = 'JOB_ABORTED';

  constructor(job: string) {
    super(`Job "${job}" was still running when the scheduler stopped.`);
    this.name = 'JobAbortedError';
  }
}

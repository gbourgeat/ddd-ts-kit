/** The lock could not be asked, so nothing says that no other instance runs the occurrence. */
export class JobLockUnavailableError extends Error {
  readonly code = 'JOB_LOCK_UNAVAILABLE';

  constructor(job: string, options: ErrorOptions) {
    super(`The lock of job "${job}" could not be asked: the occurrence is not run.`, options);
    this.name = 'JobLockUnavailableError';
  }
}

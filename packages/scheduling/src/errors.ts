/** A run lasted longer than the `timeoutMs` of its job. It is the reason of the aborted signal. */
export class JobTimeoutError extends Error {
  readonly code = 'JOB_TIMEOUT';

  constructor(job: string, timeoutMs: number) {
    super(`Job "${job}" ran longer than ${timeoutMs} ms.`);
    this.name = 'JobTimeoutError';
  }
}

/** The scheduler stopped and the run outlived the grace period. It is the reason of the aborted signal. */
export class JobAbortedError extends Error {
  readonly code = 'JOB_ABORTED';

  constructor(job: string) {
    super(`Job "${job}" was still running when the scheduler stopped.`);
    this.name = 'JobAbortedError';
  }
}

/** The lock could not be asked, so nothing says that no other instance runs the occurrence. */
export class JobLockUnavailableError extends Error {
  readonly code = 'JOB_LOCK_UNAVAILABLE';

  constructor(job: string, options: ErrorOptions) {
    super(`The lock of job "${job}" could not be asked: the occurrence is not run.`, options);
    this.name = 'JobLockUnavailableError';
  }
}

const SHORT_CODE = /^[A-Za-z0-9_.:-]{1,64}$/;
export const UNEXPECTED_ERROR = 'UNEXPECTED_ERROR';

/** The `code` of a `DomainError` or of a fault that carries a short one. Never a message. */
export function errorCodeOf(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) return UNEXPECTED_ERROR;
  const { code } = error;
  return typeof code === 'string' && SHORT_CODE.test(code) ? code : UNEXPECTED_ERROR;
}

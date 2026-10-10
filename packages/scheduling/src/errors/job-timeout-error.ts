/** A run lasted longer than the `timeoutMs` of its job. It is the reason of the aborted signal. */
export class JobTimeoutError extends Error {
  readonly code = 'JOB_TIMEOUT';

  constructor(job: string, timeoutMs: number) {
    super(`Job "${job}" ran longer than ${timeoutMs} ms.`);
    this.name = 'JobTimeoutError';
  }
}

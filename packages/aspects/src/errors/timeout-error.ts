export const TIMEOUT = 'TIMEOUT';

/** The call did not answer in time. An infrastructure fault: retried by default. */
export class TimeoutError extends Error {
  readonly code = TIMEOUT;

  constructor(
    operation: string,
    readonly timeoutMs: number,
  ) {
    super(`${operation} did not answer within ${String(timeoutMs)} ms`);
    this.name = 'TimeoutError';
  }
}

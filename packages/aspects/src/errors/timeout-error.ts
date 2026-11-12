export const TIMEOUT = 'TIMEOUT';

/**
 * The call did not answer in time. An infrastructure fault: retried by default. `statedBy` is who
 * stated the limit, when the aspect was told (`timeout(ms, { statedBy })`): the message ends with it,
 * so that a call cut by a policy it never chose says which one, and how another is stated.
 */
export class TimeoutError extends Error {
  readonly code = TIMEOUT;

  constructor(
    operation: string,
    readonly timeoutMs: number,
    readonly statedBy?: string,
  ) {
    super(
      `${operation} did not answer within ${String(timeoutMs)} ms${statedBy === undefined ? '' : ` (${statedBy})`}`,
    );

    this.name = 'TimeoutError';
  }
}

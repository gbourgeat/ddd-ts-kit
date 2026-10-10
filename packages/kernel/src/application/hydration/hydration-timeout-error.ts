/** The lookup of a relation did not answer within the time its policy gives it. */
export class HydrationTimeoutError extends Error {
  readonly code = 'HYDRATION_TIMEOUT';

  constructor(
    readonly relation: string,
    readonly timeoutMs: number,
  ) {
    super(`The lookup of "${relation}" did not answer within ${String(timeoutMs)} ms`);
    this.name = 'HydrationTimeoutError';
  }
}

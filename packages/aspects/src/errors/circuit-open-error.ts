export const CIRCUIT_OPEN = 'CIRCUIT_OPEN';

/** The call was not made: the dependency failed too often and is given time to recover. */
export class CircuitOpenError extends Error {
  readonly code = CIRCUIT_OPEN;

  constructor(
    operation: string,
    /** The instant from which a trial call is let through. */
    readonly retryAt: Date,
  ) {
    super(`${operation} is not called: its circuit is open until ${retryAt.toISOString()}`);
    this.name = 'CircuitOpenError';
  }
}

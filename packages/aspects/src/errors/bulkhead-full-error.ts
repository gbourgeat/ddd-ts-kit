export const BULKHEAD_FULL = 'BULKHEAD_FULL';

/** The call was not made: too many are running and waiting already. */
export class BulkheadFullError extends Error {
  readonly code = BULKHEAD_FULL;

  constructor(operation: string) {
    super(`${operation} is not called: its bulkhead is full`);
    this.name = 'BulkheadFullError';
  }
}

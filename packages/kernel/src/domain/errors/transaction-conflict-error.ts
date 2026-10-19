import { ConcurrencyError } from './concurrency-error.js';

/**
 * The database gave the transaction of a unit of work up for a concurrent one: a deadlock or a
 * serialization failure, raised by whichever statement it chose. Nothing of it committed, so the
 * unit of work can run again; the error of the driver is the `cause`.
 */
export class TransactionConflictError extends ConcurrencyError {
  constructor(cause: unknown) {
    super('', { cause });
    this.message = 'The transaction was given up for a concurrent one (deadlock or serialization failure)';
  }
}

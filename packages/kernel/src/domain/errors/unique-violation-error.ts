import { ConflictError } from './conflict-error';

/**
 * The database refused to store an aggregate because a value it keeps unique (an email, a
 * number) is already held by another row: a `ConflictError`, code `CONFLICT`, not a lost update,
 * so the same request run again is refused again. The error of the driver is the `cause`, when
 * the database raised one; the message names neither the value nor the column, which may be
 * personal data.
 */
export class UniqueViolationError extends ConflictError {
  constructor(aggregateId: string | number, options?: { readonly cause?: unknown }) {
    super(`Aggregate ${aggregateId} holds a value that another one already holds`, options);
  }
}

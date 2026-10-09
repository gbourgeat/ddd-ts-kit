/**
 * A violated business rule. The `code` is the stable, machine-readable contract
 * (HTTP mapping, i18n, API docs); the message is for humans and may change.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class InvariantViolation extends DomainError {
  readonly code = 'INVARIANT_VIOLATION';
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}

/** The code every repository adapter raises on a lost update, whatever the storage. */
export const CONCURRENCY_CONFLICT = 'CONCURRENCY_CONFLICT';

/** Somebody else saved the aggregate since it was loaded. */
export class ConcurrencyError extends DomainError {
  readonly code = CONCURRENCY_CONFLICT;

  constructor(aggregateId: string | number) {
    super(`Aggregate ${aggregateId} was modified concurrently`);
  }
}

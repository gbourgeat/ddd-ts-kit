import { DomainError } from './domain-error.js';

/** The code every repository adapter raises on a lost update, whatever the storage. */
export const CONCURRENCY_CONFLICT = 'CONCURRENCY_CONFLICT';

/** Somebody else saved the aggregate since it was loaded. */
export class ConcurrencyError extends DomainError {
  readonly code = CONCURRENCY_CONFLICT;

  constructor(aggregateId: string | number, options?: { readonly cause?: unknown }) {
    super(`Aggregate ${aggregateId} was modified concurrently`, options);
  }
}

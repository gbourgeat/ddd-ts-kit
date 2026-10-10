import { DomainError } from './domain-error.js';

/** The code every repository adapter raises on a lost update, whatever the storage. */
export const CONCURRENCY_CONFLICT = 'CONCURRENCY_CONFLICT';

/** Somebody else saved the aggregate since it was loaded. */
export class ConcurrencyError extends DomainError {
  readonly code = CONCURRENCY_CONFLICT;

  constructor(aggregateId: string | number) {
    super(`Aggregate ${aggregateId} was modified concurrently`);
  }
}

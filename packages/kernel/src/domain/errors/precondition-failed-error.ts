import { DomainError } from './domain-error';

/** The code of a write refused because the version the caller read is no longer the current one. */
export const PRECONDITION_FAILED = 'PRECONDITION_FAILED';

/**
 * The caller acted on a version of the element it read, and the element changed since: answered
 * 412 over HTTP, where the version came in `If-Match`. Unlike a `ConcurrencyError`, nobody wrote
 * at the same instant: the caller read long enough ago for somebody else to write in between.
 */
export class PreconditionFailedError extends DomainError {
  readonly code = PRECONDITION_FAILED;
}

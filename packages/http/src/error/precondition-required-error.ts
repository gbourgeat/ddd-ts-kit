import { DomainError } from '@ddd-ts-kit/kernel';

/** The code of a write refused because it does not name the version it was made on. */
export const PRECONDITION_REQUIRED = 'PRECONDITION_REQUIRED';

/** A route that requires `If-Match` was called without it: answered 428. */
export class PreconditionRequiredError extends DomainError {
  readonly code = PRECONDITION_REQUIRED;
}

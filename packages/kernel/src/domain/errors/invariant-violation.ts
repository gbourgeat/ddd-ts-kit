import { DomainError } from './domain-error.js';

export class InvariantViolation extends DomainError {
  readonly code = 'INVARIANT_VIOLATION';
}

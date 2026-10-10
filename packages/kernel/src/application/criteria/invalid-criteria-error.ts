import { DomainError } from '../../domain/errors/domain-error.js';
import type { CriteriaViolation } from './criteria-violation.js';

export const INVALID_CRITERIA = 'INVALID_CRITERIA';

/** A criteria its definition refuses reached a read port: the boundary let it through unvalidated. */
export class InvalidCriteriaError extends DomainError {
  readonly code = INVALID_CRITERIA;

  constructor(readonly violations: readonly CriteriaViolation[]) {
    super(`The criteria is refused: ${violations.map(({ path, code }) => `${path} (${code})`).join(', ')}`);
  }
}

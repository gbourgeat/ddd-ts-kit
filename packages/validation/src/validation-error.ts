import { DomainError } from '@ddd-ts-kit/kernel';
import type { ValidationIssue } from './validation-issue.js';

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_FAILED';

  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[], message = 'The input is not valid.') {
    super(message);
    this.issues = issues;
  }
}

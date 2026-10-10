import type { ValidationIssue } from '@ddd-ts-kit/validation';

/** The route answered something its declaration does not allow; reported as a 500. */
export class ResponseContractError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(message: string, issues: readonly ValidationIssue[] = []) {
    super(message);
    this.name = 'ResponseContractError';
    this.issues = issues;
  }
}

import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidRangeError extends DomainError {
  readonly code = 'INVALID_RANGE';

  constructor(rule: string) {
    super(`A range ${rule}.`);
  }
}

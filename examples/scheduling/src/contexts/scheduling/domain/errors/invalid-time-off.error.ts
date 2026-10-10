import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidTimeOffError extends DomainError {
  readonly code = 'INVALID_TIME_OFF';

  constructor(rule: string) {
    super(`A time off ${rule}.`);
  }
}

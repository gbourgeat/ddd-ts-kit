import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidDayError extends DomainError {
  readonly code = 'INVALID_DAY';

  constructor(value: string) {
    super(`"${value}" is not a day: a calendar date is written YYYY-MM-DD and exists.`);
  }
}

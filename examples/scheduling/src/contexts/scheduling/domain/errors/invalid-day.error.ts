import { DomainError } from '@ddd-ts-kit/kernel';

export class InvalidDayError extends DomainError {
  readonly code = 'INVALID_DAY';

  constructor(day: string) {
    super(`${day} is not a day written YYYY-MM-DD.`);
  }
}

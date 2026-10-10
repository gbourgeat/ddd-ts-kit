import { DomainError } from '@ddd-ts-kit/kernel';

export class UnknownTimeZoneError extends DomainError {
  readonly code = 'UNKNOWN_TIME_ZONE';

  constructor(name: string) {
    super(`${name} is not a known time zone.`);
  }
}

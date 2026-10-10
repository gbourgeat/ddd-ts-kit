import { DomainError } from '@ddd-ts-kit/kernel';

export class UnknownTimeZoneError extends DomainError {
  readonly code = 'UNKNOWN_TIME_ZONE';

  constructor(readonly value: string) {
    super(`"${value}" is not an IANA time zone.`);
  }
}

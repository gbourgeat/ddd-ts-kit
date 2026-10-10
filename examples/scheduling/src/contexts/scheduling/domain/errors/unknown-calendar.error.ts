import { DomainError } from '@ddd-ts-kit/kernel';

export class UnknownCalendarError extends DomainError {
  readonly code = 'UNKNOWN_CALENDAR';

  constructor(calendarId: string) {
    super(`There is no calendar ${calendarId}.`);
  }
}

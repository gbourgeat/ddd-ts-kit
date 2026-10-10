import { DomainError } from '@ddd-ts-kit/kernel';

export class SlotTakenError extends DomainError {
  readonly code = 'SLOT_TAKEN';

  constructor(calendarId: string, startsAt: Date) {
    super(`The slot starting at ${startsAt.toISOString()} on calendar ${calendarId} is already held.`);
  }
}

import { DomainRefusal } from '../../src/index.js';

export const SchedulingCodes = {
  SlotTaken: 'SLOT_TAKEN',
  BookingTooLate: 'BOOKING_TOO_LATE',
  AgendaUnreachable: 'AGENDA_UNREACHABLE',
} as const;

export type SchedulingCode = (typeof SchedulingCodes)[keyof typeof SchedulingCodes];

export class SlotTaken extends DomainRefusal {
  readonly code = SchedulingCodes.SlotTaken;

  static forCalendar(calendarId: string, startsAt: Date) {
    return SlotTaken.refusal(`The slot at ${startsAt.toISOString()} on ${calendarId} is held.`, {
      calendarId,
      startsAt,
    }).exposing('startsAt');
  }

  static atStart(startsAt: Date) {
    return SlotTaken.refusal(`The slot at ${startsAt.toISOString()} is held.`, { startsAt });
  }
}

export class BookingTooLate extends DomainRefusal {
  readonly code = SchedulingCodes.BookingTooLate;

  static withNotice(notice: number) {
    return BookingTooLate.refusal(`A slot is booked ${notice} minutes ahead.`, { notice });
  }
}

export class AgendaUnreachable extends DomainRefusal {
  readonly code = SchedulingCodes.AgendaUnreachable;

  static becauseOf(cause: unknown) {
    return AgendaUnreachable.refusal('The agenda cannot be read.').causedBy(cause);
  }
}

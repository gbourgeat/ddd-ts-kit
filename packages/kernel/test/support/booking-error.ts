import { ConceptError } from '../../src';

export class BookingError extends ConceptError {
  static slotTaken(calendarId: string, startsAt: Date) {
    return BookingError.refusal('SLOT_TAKEN', `The slot at ${startsAt.toISOString()} on ${calendarId} is held.`, {
      calendarId,
      startsAt,
    }).exposing('startsAt');
  }

  static tooLate(notice: number) {
    return BookingError.refusal('BOOKING_TOO_LATE', `A slot is booked ${notice} minutes ahead.`, { notice });
  }

  static reasonRequired() {
    return BookingError.refusal('REASON_REQUIRED', 'A reason is given.');
  }

  static storeUnreachable(cause: unknown) {
    return BookingError.refusal('STORE_UNREACHABLE', 'The agenda cannot be read.').causedBy(cause);
  }
}

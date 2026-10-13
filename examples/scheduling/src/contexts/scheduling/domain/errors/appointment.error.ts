import { ConceptError } from '@ddd-ts-kit/kernel';

export class AppointmentError extends ConceptError {
  static alreadyConfirmed(appointmentId: string) {
    return AppointmentError.refusal(
      'APPOINTMENT_ALREADY_CONFIRMED',
      `Appointment ${appointmentId} is booked: nothing is left to confirm.`,
      { appointmentId },
    );
  }

  static ended(appointmentId: string, status: string) {
    return AppointmentError.refusal(
      'APPOINTMENT_ENDED',
      `Appointment ${appointmentId} is ${status} and does not change any more.`,
      { appointmentId, status },
    ).exposing('status');
  }

  static notFound(appointmentId: string) {
    return AppointmentError.refusal('APPOINTMENT_NOT_FOUND', `Appointment ${appointmentId} does not exist.`, {
      appointmentId,
    });
  }

  static notStarted(appointmentId: string, startsAt: Date) {
    return AppointmentError.refusal(
      'APPOINTMENT_NOT_STARTED',
      `Appointment ${appointmentId} starts at ${startsAt.toISOString()}: its outcome is not known before.`,
      { appointmentId, startsAt },
    ).exposing('startsAt');
  }

  static bookingTooFar(horizon: number) {
    return AppointmentError.refusal(
      'BOOKING_TOO_FAR',
      `A slot is booked at most ${horizon} minutes before it starts.`,
      { horizon },
    ).exposing('horizon');
  }

  static bookingTooLate(notice: number) {
    return AppointmentError.refusal(
      'BOOKING_TOO_LATE',
      `A slot is booked at least ${notice} minutes before it starts.`,
      { notice },
    ).exposing('notice');
  }

  static invalidBooking(reason: string) {
    return AppointmentError.refusal('INVALID_BOOKING', `A booking ${reason}.`, { reason });
  }

  static invalidSlot(reason: string) {
    return AppointmentError.refusal('INVALID_SLOT', `A slot ${reason}.`, { reason });
  }

  static offGrid(grid: number) {
    return AppointmentError.refusal(
      'OFF_GRID',
      `An appointment of this type starts on a step of ${grid} minutes from midnight.`,
      { grid },
    ).exposing('grid');
  }

  static outsideAvailability(startsAt: Date) {
    return AppointmentError.refusal(
      'OUTSIDE_AVAILABILITY',
      `The calendar takes no appointment at ${startsAt.toISOString()}.`,
      { startsAt },
    ).exposing('startsAt');
  }

  static patientLimitReached(limit: number) {
    return AppointmentError.refusal(
      'PATIENT_LIMIT_REACHED',
      `The patient already holds ${limit} future appointments with this practitioner.`,
      { limit },
    ).exposing('limit');
  }

  static reasonRequired() {
    return AppointmentError.refusal('REASON_REQUIRED', 'The practice gives a reason when it cancels an appointment.');
  }

  static slotTaken(calendarId: string, startsAt: Date) {
    return AppointmentError.refusal(
      'SLOT_TAKEN',
      `The slot starting at ${startsAt.toISOString()} on calendar ${calendarId} is already held.`,
      { calendarId, startsAt },
    ).exposing('startsAt');
  }

  static noDocument(appointmentId: string) {
    return AppointmentError.refusal('NO_DOCUMENT', `Appointment ${appointmentId} holds no document.`, {
      appointmentId,
    });
  }

  static documentNameTooLong(longest: number) {
    return AppointmentError.refusal(
      'DOCUMENT_NAME_TOO_LONG',
      `The name of a document holds at most ${longest} characters.`,
      { longest },
    ).exposing('longest');
  }
}

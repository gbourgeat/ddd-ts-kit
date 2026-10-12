import { ConceptError } from '@ddd-ts-kit/kernel';

export class CalendarError extends ConceptError {
  static invalidAppointmentType(rule: string) {
    return CalendarError.refusal('INVALID_APPOINTMENT_TYPE', `An appointment type ${rule}.`, { rule });
  }

  static invalidBookingWindow(rule: string) {
    return CalendarError.refusal('INVALID_BOOKING_WINDOW', `A booking window ${rule}.`, { rule });
  }

  static invalidDay(day: string) {
    return CalendarError.refusal('INVALID_DAY', `${day} is not a day written YYYY-MM-DD.`, { day }).exposing('day');
  }

  static invalidRange(rule: string) {
    return CalendarError.refusal('INVALID_RANGE', `A range ${rule}.`, { rule });
  }

  static invalidTimeOff(rule: string) {
    return CalendarError.refusal('INVALID_TIME_OFF', `A time off ${rule}.`, { rule });
  }

  static timeOffOverAppointments(held: number) {
    return CalendarError.refusal('TIME_OFF_OVER_APPOINTMENTS', `The time off covers ${held} active appointment(s).`, {
      held,
    }).exposing('held');
  }

  static unknownAppointmentType(appointmentTypeId: string) {
    return CalendarError.refusal(
      'UNKNOWN_APPOINTMENT_TYPE',
      `The calendar offers no appointment type ${appointmentTypeId}.`,
      { appointmentTypeId },
    );
  }

  static unknown(calendarId: string) {
    return CalendarError.refusal('UNKNOWN_CALENDAR', `There is no calendar ${calendarId}.`, { calendarId });
  }

  static unknownPractitioner(practiceId: string, practitionerId: string) {
    return CalendarError.refusal(
      'UNKNOWN_PRACTITIONER',
      `The person ${practitionerId} is not a practitioner of the practice ${practiceId}.`,
      { practiceId, practitionerId },
    );
  }

  static unknownTimeZone(name: string) {
    return CalendarError.refusal('UNKNOWN_TIME_ZONE', `${name} is not a known time zone.`, { name });
  }
}

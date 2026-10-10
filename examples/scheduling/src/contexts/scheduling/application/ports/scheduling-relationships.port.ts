/**
 * What the platform must know of the calendars and the appointments to decide a right on one of
 * them. Recorded in the unit of work of the command that states the fact; recording twice changes
 * nothing.
 */
export abstract class SchedulingRelationships {
  /** A calendar belongs to the desk of its practitioner in its practice, and to that practice. */
  abstract recordCalendar(calendar: { readonly calendarId: string; readonly practiceId: string; readonly practitionerId: string }): Promise<void>;

  /** An appointment is its patient's, and belongs to the calendar it is held on. */
  abstract recordAppointment(appointment: { readonly appointmentId: string; readonly calendarId: string; readonly patientId: string }): Promise<void>;
}

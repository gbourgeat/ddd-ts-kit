/** An appointment as scheduling states it now, with the instant of the last fact its state reflects. */
export interface ExportedAppointment {
  readonly appointmentId: string;
  readonly calendarId: string;
  readonly practiceId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  /** The date of the start in the time zone of the practice, `YYYY-MM-DD`. */
  readonly day: string;
  readonly outcome: 'held' | 'completed' | 'no-show' | 'cancelled-by-patient' | 'cancelled-by-practice' | 'expired';
  /** ISO 8601: when the appointment last changed. */
  readonly changedAt: string;
}

export interface ExportedAppointmentPage {
  readonly appointments: readonly ExportedAppointment[];
  /** Absent on the last page. */
  readonly nextCursor?: string;
}

/** The source of truth a downstream read model is rebuilt from. */
export abstract class AppointmentExportContract {
  /** Every appointment, page by page, in a stable order. */
  abstract export(cursor?: string): Promise<ExportedAppointmentPage>;

  /** These appointments as they are now; an unknown identifier is left out. */
  abstract lookup(appointmentIds: readonly string[]): Promise<readonly ExportedAppointment[]>;
}

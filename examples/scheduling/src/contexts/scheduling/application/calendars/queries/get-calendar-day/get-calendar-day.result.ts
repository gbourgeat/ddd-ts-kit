import type { AppointmentStatus } from '@/contexts/scheduling/domain/calendars/vocabularies/appointment-status.vocabulary';

/**
 * The shared view of one day of a calendar: when it is open, what it offers and what is held.
 * A held slot the asker may read carries its appointment; any other only says busy.
 */
export interface GetCalendarDayResult {
  readonly calendarId: string;
  readonly day: string;
  readonly timeZone: string;
  /** The opening ranges of the day, as instants. */
  readonly open: readonly { readonly startsAt: Date; readonly endsAt: Date }[];
  /** The time off that crosses the day: nothing can be booked during it. */
  readonly timeOff: readonly { readonly startsAt: Date; readonly endsAt: Date }[];
  readonly appointmentTypes: readonly {
    readonly id: string;
    readonly name: string;
    readonly duration: number;
    readonly grid: number;
    readonly buffer: number;
    readonly needsConfirmation: boolean;
  }[];
  /** What the active appointments hold, by start; `heldUntil` counts the buffer. */
  readonly busy: readonly {
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly heldUntil: Date;
    /** Only for an appointment the asker may read. */
    readonly appointment?: {
      readonly id: string;
      readonly patientId: string;
      readonly appointmentTypeId: string;
      readonly status: typeof AppointmentStatus.Requested | typeof AppointmentStatus.Booked;
    };
  }[];
}

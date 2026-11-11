import type { SchedulingRelationships } from '@/contexts/scheduling/calendars/application/ports/scheduling-relationships.port';

type RecordedCalendar = Parameters<SchedulingRelationships['recordCalendar']>[0];
type RecordedAppointment = Parameters<SchedulingRelationships['recordAppointment']>[0];

/** Keeps what is currently known, one line per relationship, so that a test reads the outcome and not the calls. */
export class FakeSchedulingRelationships implements SchedulingRelationships {
  private readonly known = new Set<string>();

  get current(): readonly string[] {
    return [...this.known].sort();
  }

  async recordCalendar({ calendarId, practiceId, practitionerId }: RecordedCalendar): Promise<void> {
    this.known.add(`calendar ${calendarId} of desk ${practiceId}.${practitionerId}`);
    this.known.add(`calendar ${calendarId} of practice ${practiceId}`);
  }

  async recordAppointment({ appointmentId, calendarId, patientId }: RecordedAppointment): Promise<void> {
    this.known.add(`appointment ${appointmentId} of patient ${patientId}`);
    this.known.add(`appointment ${appointmentId} on calendar ${calendarId}`);
  }
}

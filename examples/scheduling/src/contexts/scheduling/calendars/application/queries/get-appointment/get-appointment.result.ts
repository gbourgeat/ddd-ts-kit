import type { AgendaEntry } from '@/contexts/scheduling/calendars/application/ports/agenda.port';

/** The entry of the agenda, and the name identity shows for its patient: absent when identity could not say. */
export interface GetAppointmentResult extends AgendaEntry {
  readonly patientName?: string;
}

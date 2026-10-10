import type { AgendaEntry } from '../../ports/agenda.port.js';

/** The entry of the agenda, and the name identity shows for its patient: absent when identity could not say. */
export interface GetAppointmentResult extends AgendaEntry {
  readonly patientName?: string;
}

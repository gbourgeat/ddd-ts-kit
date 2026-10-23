import { ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';
import type { AppointmentStatus } from '@/contexts/scheduling/domain/calendars/vocabularies/appointment-status.vocabulary';

/** One appointment as the agenda shows it: what it holds and where it stands, under the identifier of the appointment. */
export type AgendaEntry = {
  readonly id: string;
  readonly calendarId: string;
  readonly practiceId: string;
  readonly practitionerId: string;
  readonly patientId: string;
  readonly appointmentTypeId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  /** The end of what the appointment holds, its buffer included. */
  readonly heldUntil: Date;
  /** The date of the start in the time zone of the practice, `YYYY-MM-DD`. */
  readonly day: string;
  readonly status: AppointmentStatus;
  readonly confirmBefore: Date | null;
  readonly cancelledBy: 'patient' | 'practice' | null;
  /** What the staff of the practice keeps about the appointment: an answer shows it only to them. */
  readonly internalNote: string | null;
  readonly changedAt: Date;
};

export const agendaCriteria = defineCriteria<AgendaEntry>({
  fields: {
    id: { type: 'string', filter: ['eq', 'in'] },
    calendarId: { type: 'string', filter: ['eq', 'in'] },
    practiceId: { type: 'string', filter: ['eq'] },
    practitionerId: { type: 'string', filter: ['eq'] },
    patientId: { type: 'string', filter: ['eq'] },
    appointmentTypeId: { type: 'string', filter: ['eq'] },
    startsAt: { type: 'instant', filter: ['gte', 'lt', 'between'], sortable: true },
    endsAt: { type: 'instant' },
    heldUntil: { type: 'instant', filter: ['gt'] },
    day: { type: 'string', filter: ['eq', 'gte', 'lte', 'between'], sortable: true },
    status: { type: 'string', filter: ['eq', 'ne', 'in'] },
    confirmBefore: { type: 'instant', filter: ['isNull'], nullable: true },
    cancelledBy: { type: 'string', filter: ['eq', 'isNull'], nullable: true },
    changedAt: { type: 'instant', sortable: true },
  },
  defaultSort: [{ field: 'startsAt', direction: 'asc' }],
  tieBreaker: 'id',
  limits: { maxPageSize: 100 },
});

/** The agenda: every appointment, kept up to date from the facts of the appointments, read by the lists and the detail. */
export abstract class Agenda extends ReadModelStore<AgendaEntry> {}

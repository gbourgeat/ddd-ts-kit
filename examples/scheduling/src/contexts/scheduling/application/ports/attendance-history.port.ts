import { ReadModelStore, defineCriteria } from '@ddd-ts-kit/kernel';

/** One fact of an attendance record, as its history shows it, under the identifier `<record>#<version>`. */
export type AttendanceEntry = {
  readonly id: string;
  readonly recordId: string;
  /** Its rank in the stream of the record: the history reads in this order. */
  readonly version: number;
  readonly fact: 'opened' | 'no-show' | 'cancellation';
  readonly appointmentId: string | null;
  readonly startsAt: Date | null;
  /** The words of a patient who cancelled, `[erased]` once the patient was erased. */
  readonly reason: string | null;
  readonly notedAt: Date;
};

export const attendanceHistoryCriteria = defineCriteria<AttendanceEntry>({
  fields: {
    id: { type: 'string' },
    recordId: { type: 'string', filter: ['eq'] },
    version: { type: 'number', sortable: true },
    fact: { type: 'string', filter: ['eq', 'in'] },
    appointmentId: { type: 'string', filter: ['eq'], nullable: true },
    startsAt: { type: 'instant', nullable: true },
    reason: { type: 'string', nullable: true },
    notedAt: { type: 'instant', sortable: true },
  },
  defaultSort: [{ field: 'version', direction: 'asc' }],
  tieBreaker: 'id',
  limits: { maxPageSize: 100 },
});

/** The history of the attendance records: kept by a projection fed by the event store, and rebuilt from it. */
export abstract class AttendanceHistory extends ReadModelStore<AttendanceEntry> {}

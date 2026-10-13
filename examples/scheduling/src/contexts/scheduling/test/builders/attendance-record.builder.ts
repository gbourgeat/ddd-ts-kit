import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';
import {
  AttendanceRecord,
  type AttendanceRecordEvent,
} from '@/contexts/scheduling/domain/aggregates/attendance-record.aggregate';
import { AttendanceRecordCreated } from '@/contexts/scheduling/domain/events/attendance-record-created.event';
import { AttendanceRecordNoShowNoted } from '@/contexts/scheduling/domain/events/attendance-record-no-show-noted.event';

interface AttendanceRecordIngredients {
  readonly practiceId: string;
  readonly patientId: string;
  readonly bornAt: Date;
  /** The appointments the patient did not come to, in order. */
  readonly noShows: readonly string[];
}

const DAY = 86_400_000;

/** Builds an attendance record the way a load does: by replaying the history of its events. */
export class AttendanceRecordBuilder extends Builder<AttendanceRecordIngredients, AttendanceRecord> {
  ofPatient(patientId: string): this {
    return this.with('patientId', patientId);
  }

  inPractice(practiceId: string): this {
    return this.with('practiceId', practiceId);
  }

  bornAt(instant: Date): this {
    return this.with('bornAt', instant);
  }

  /** A no-show noted on the appointment, a day after the previous fact. */
  missed(appointmentId: string): this {
    return this.adding('noShows', appointmentId);
  }

  protected defaults(): Defaults<AttendanceRecordIngredients> {
    return {
      practiceId: 'practice-1',
      patientId: sequence('patient'),
      bornAt: new Date('2026-01-01T00:00:00.000Z'),
      noShows: [],
    };
  }

  protected construct({ practiceId, patientId, bornAt, noShows }: AttendanceRecordIngredients): AttendanceRecord {
    const id = AttendanceRecord.idOf(practiceId, patientId);

    const events: AttendanceRecordEvent[] = [
      new AttendanceRecordCreated(id, bornAt, { practiceId, patientId }),
      ...noShows.map((appointmentId, index) => {
        const at = new Date(bornAt.getTime() + (index + 1) * DAY);

        return new AttendanceRecordNoShowNoted(id, at, { appointmentId, startsAt: at });
      }),
    ];

    return AttendanceRecord.rehydrate(id, { events });
  }
}

export function anAttendanceRecord(): AttendanceRecordBuilder {
  return new AttendanceRecordBuilder();
}

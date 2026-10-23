import type { SnapshotPolicy } from '@ddd-ts-kit/kernel';
import type {
  AttendanceRecord,
  AttendanceRecordState,
} from '@/contexts/scheduling/domain/calendars/aggregates/attendance-record.aggregate';

/**
 * How a snapshot of an attendance record is kept: its whole state, which holds no personal value
 * (the words of a cancellation stay in its event). A snapshot can always be thrown away: `version` changes with its shape, and a
 * snapshot of another version is ignored.
 */
export const attendanceRecordSnapshots: Pick<
  SnapshotPolicy<AttendanceRecord, AttendanceRecordState>,
  'version' | 'encode' | 'decode'
> = {
  version: 1,
  encode: (record) => record.toState(),
  decode: (data) => ({
    registeredAt: data.instant('registeredAt'),
    practiceId: data.text('practiceId'),
    patientId: data.text('patientId'),
    noted: data.texts('noted'),
    missed: data.number('missed'),
  }),
};

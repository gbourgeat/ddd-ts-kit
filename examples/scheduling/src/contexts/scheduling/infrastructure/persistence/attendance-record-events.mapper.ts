import { defineStoredEvent, personalData, type PersonalValue, type StoredEventTypes } from '@ddd-ts-kit/kernel';
import type { AttendanceRecordEvent } from '@/contexts/scheduling/domain/aggregates/attendance-record.aggregate';
import { AttendanceRecordCancellationNoted } from '@/contexts/scheduling/domain/events/attendance-record-cancellation-noted.event';
import { AttendanceRecordCreated } from '@/contexts/scheduling/domain/events/attendance-record-created.event';
import { AttendanceRecordNoShowNoted } from '@/contexts/scheduling/domain/events/attendance-record-no-show-noted.event';

interface AttendanceRecordCreatedData {
  readonly practiceId: string;
  readonly patientId: string;
}

interface AttendanceRecordNoShowNotedData {
  readonly appointmentId: string;
  readonly startsAt: Date;
}

interface AttendanceRecordCancellationNotedData {
  readonly appointmentId: string;
  readonly startsAt: Date;
  /** The words of the patient, sealed with the key of the patient: erased with it. */
  readonly reason: PersonalValue | null;
}

/** How the events of AttendanceRecord are kept in its stream: one entry per event, read back by `decode`. */
export const attendanceRecordEvents: StoredEventTypes<AttendanceRecordEvent> = {
  'scheduling.attendance-record.created': defineStoredEvent(AttendanceRecordCreated, {
    version: 1,
    encode: (event): AttendanceRecordCreatedData => event.held,
    decode: (data, { aggregateId, occurredAt }) =>
      new AttendanceRecordCreated(aggregateId, occurredAt, {
        practiceId: data.text('practiceId'),
        patientId: data.text('patientId'),
      }),
  }),
  'scheduling.attendance-record.no-show-noted': defineStoredEvent(AttendanceRecordNoShowNoted, {
    version: 1,
    encode: (event): AttendanceRecordNoShowNotedData => event.missed,
    decode: (data, { aggregateId, occurredAt }) =>
      new AttendanceRecordNoShowNoted(aggregateId, occurredAt, {
        appointmentId: data.text('appointmentId'),
        startsAt: data.instant('startsAt'),
      }),
  }),
  'scheduling.attendance-record.cancellation-noted': defineStoredEvent(AttendanceRecordCancellationNoted, {
    version: 1,
    encode: (event): AttendanceRecordCancellationNotedData => ({
      appointmentId: event.cancelled.appointmentId,
      startsAt: event.cancelled.startsAt,
      reason: event.cancelled.reason === undefined ? null : personalData(patientOf(event), event.cancelled.reason),
    }),
    decode: (data, { aggregateId, occurredAt }) =>
      new AttendanceRecordCancellationNoted(aggregateId, occurredAt, {
        appointmentId: data.text('appointmentId'),
        startsAt: data.instant('startsAt'),
        reason: data.optionalText('reason'),
      }),
  }),
};

/** The data subject of a record is its patient, the second part of its identifier. */
function patientOf(event: AttendanceRecordCancellationNoted): string {
  return event.aggregateId.slice(event.aggregateId.indexOf('.') + 1);
}

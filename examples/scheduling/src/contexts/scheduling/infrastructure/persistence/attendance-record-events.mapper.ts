import { defineStoredEvent, personalData, type PersonalValue, type StoredEventTypes } from '@ddd-ts-kit/kernel';
import type { AttendanceRecordEvent } from '@/contexts/scheduling/domain/calendars/aggregates/attendance-record.aggregate';
import { AttendanceRecordCancellationNoted } from '@/contexts/scheduling/domain/calendars/events/attendance-record-cancellation-noted.event';
import { AttendanceRecordCreated } from '@/contexts/scheduling/domain/calendars/events/attendance-record-created.event';
import { AttendanceRecordNoShowNoted } from '@/contexts/scheduling/domain/calendars/events/attendance-record-no-show-noted.event';

interface AttendanceRecordCreatedData {
  readonly practiceId: string;
  readonly patientId: string;
}

interface AttendanceRecordNoShowNotedData {
  readonly appointmentId: string;
  readonly startsAt: Date;
}

interface AttendanceRecordCancellationNotedData {
  /** The data subject the reason is sealed for, carried by the event rather than read from the identifier of the record. */
  readonly patientId: string;
  readonly appointmentId: string;
  readonly startsAt: Date;
  /** The words of the patient, sealed with the key of the patient: erased with it. */
  readonly reason: PersonalValue | null;
}

/** How the events of AttendanceRecord are kept in its stream: one entry per event, read back by `decode`. */
export const attendanceRecordEvents: StoredEventTypes<AttendanceRecordEvent> = {
  [AttendanceRecordCreated.eventName]: defineStoredEvent(AttendanceRecordCreated, {
    version: 1,
    encode: (event): AttendanceRecordCreatedData => event.held,
    decode: (data, { aggregateId, occurredAt }) =>
      new AttendanceRecordCreated(aggregateId, occurredAt, {
        practiceId: data.text('practiceId'),
        patientId: data.text('patientId'),
      }),
  }),
  [AttendanceRecordNoShowNoted.eventName]: defineStoredEvent(AttendanceRecordNoShowNoted, {
    version: 1,
    encode: (event): AttendanceRecordNoShowNotedData => event.missed,
    decode: (data, { aggregateId, occurredAt }) =>
      new AttendanceRecordNoShowNoted(aggregateId, occurredAt, {
        appointmentId: data.text('appointmentId'),
        startsAt: data.instant('startsAt'),
      }),
  }),
  [AttendanceRecordCancellationNoted.eventName]: defineStoredEvent(AttendanceRecordCancellationNoted, {
    version: 1,
    encode: ({ cancelled }): AttendanceRecordCancellationNotedData => ({
      patientId: cancelled.patientId,
      appointmentId: cancelled.appointmentId,
      startsAt: cancelled.startsAt,
      reason: cancelled.reason === undefined ? null : personalData(cancelled.patientId, cancelled.reason),
    }),
    decode: (data, { aggregateId, occurredAt }) =>
      new AttendanceRecordCancellationNoted(aggregateId, occurredAt, {
        patientId: data.text('patientId'),
        appointmentId: data.text('appointmentId'),
        startsAt: data.instant('startsAt'),
        reason: data.optionalText('reason'),
      }),
  }),
};

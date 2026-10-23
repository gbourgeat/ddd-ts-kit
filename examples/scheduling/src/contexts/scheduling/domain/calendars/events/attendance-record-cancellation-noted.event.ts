import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class AttendanceRecordCancellationNoted implements DomainEvent {
  static readonly eventName = 'scheduling.attendance-record.cancellation-noted';

  readonly name = AttendanceRecordCancellationNoted.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** The patient who cancelled, the appointment, when it was to start, and the words they gave, if any: personal data of that patient. */
    readonly cancelled: {
      readonly patientId: string;
      readonly appointmentId: string;
      readonly startsAt: Date;
      readonly reason: string | undefined;
    },
  ) {}
}

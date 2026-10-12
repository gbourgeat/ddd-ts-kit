import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class AttendanceRecordCancellationNoted implements DomainEvent {
  readonly name = 'scheduling.attendance-record.cancellation-noted';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** The appointment the patient cancelled, when it was to start, and the words they gave, if any: personal data. */
    readonly cancelled: {
      readonly appointmentId: string;
      readonly startsAt: Date;
      readonly reason: string | undefined;
    },
  ) {}
}

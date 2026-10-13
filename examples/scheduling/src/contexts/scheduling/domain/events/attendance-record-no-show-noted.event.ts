import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class AttendanceRecordNoShowNoted implements DomainEvent {
  static readonly eventName = 'scheduling.attendance-record.no-show-noted';

  readonly name = AttendanceRecordNoShowNoted.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** The appointment the patient did not come to, and when it was to start. */
    readonly missed: { readonly appointmentId: string; readonly startsAt: Date },
  ) {}
}

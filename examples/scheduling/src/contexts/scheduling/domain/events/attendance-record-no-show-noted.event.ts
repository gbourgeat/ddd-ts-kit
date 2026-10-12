import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class AttendanceRecordNoShowNoted implements DomainEvent {
  readonly name = 'scheduling.attendance-record.no-show-noted';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** The appointment the patient did not come to, and when it was to start. */
    readonly missed: { readonly appointmentId: string; readonly startsAt: Date },
  ) {}
}

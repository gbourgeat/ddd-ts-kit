import type { DomainEvent } from '@ddd-ts-kit/kernel';

export class AttendanceRecordCreated implements DomainEvent {
  readonly name = 'scheduling.attendance-record.created';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** The practice that keeps the record, and the patient it is about. */
    readonly held: { readonly practiceId: string; readonly patientId: string },
  ) {}
}

import type { DomainEvent } from '@ddd-ts-kit/kernel';

/** The staff of the practice wrote an internal note on the appointment: what they keep about it, never shown to its patient. */
export class AppointmentAnnotated implements DomainEvent {
  readonly name = 'scheduling.appointment.annotated';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly internalNote: string,
  ) {}
}

import type { DomainEvent } from '@ddd-ts-kit/kernel';

/** The staff of the practice wrote an internal note on the appointment: what they keep about it, never shown to its patient. */
export class AppointmentAnnotated implements DomainEvent {
  static readonly eventName = 'scheduling.appointment.annotated';

  readonly name = AppointmentAnnotated.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly internalNote: string,
  ) {}
}

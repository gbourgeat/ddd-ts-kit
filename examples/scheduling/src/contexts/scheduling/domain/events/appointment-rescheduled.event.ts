import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '#src/contexts/scheduling/domain/value-objects/booking.vo.js';

export class AppointmentRescheduled implements DomainEvent {
  readonly name = 'scheduling.appointment.rescheduled';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** What the appointment holds now, and what it held before, free again. */
    readonly moved: { readonly booking: Booking; readonly previous: Booking },
  ) {}
}

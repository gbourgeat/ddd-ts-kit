import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo';

export class AppointmentRescheduled implements DomainEvent {
  static readonly eventName = 'scheduling.appointment.rescheduled';

  readonly name = AppointmentRescheduled.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** What the appointment holds now, and what it held before, free again. */
    readonly moved: { readonly booking: Booking; readonly previous: Booking },
  ) {}
}

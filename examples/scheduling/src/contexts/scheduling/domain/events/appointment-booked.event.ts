import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo.js';

export class AppointmentBooked implements DomainEvent {
  readonly name = 'scheduling.appointment.booked';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** What is held, and the instant before which it must be confirmed when the appointment is only requested. */
    readonly held: { readonly booking: Booking; readonly confirmBefore?: Date },
  ) {}
}

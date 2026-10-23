import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '@/contexts/scheduling/domain/calendars/value-objects/booking.vo';

export class AppointmentBooked implements DomainEvent {
  static readonly eventName = 'scheduling.appointment.booked';

  readonly name = AppointmentBooked.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** What is held, and the instant before which it must be confirmed when the appointment is only requested. */
    readonly held: { readonly booking: Booking; readonly confirmBefore?: Date },
  ) {}
}

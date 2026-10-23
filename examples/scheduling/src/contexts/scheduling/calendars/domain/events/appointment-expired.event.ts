import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '@/contexts/scheduling/calendars/domain/value-objects/booking.vo';

export class AppointmentExpired implements DomainEvent {
  static readonly eventName = 'scheduling.appointment.expired';

  readonly name = AppointmentExpired.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** What the appointment held: its slot is free again. */
    readonly booking: Booking,
  ) {}
}

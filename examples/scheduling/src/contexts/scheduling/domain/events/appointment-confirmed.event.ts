import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo';

export class AppointmentConfirmed implements DomainEvent {
  static readonly eventName = 'scheduling.appointment.confirmed';

  readonly name = AppointmentConfirmed.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly booking: Booking,
  ) {}
}

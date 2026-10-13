import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo';

export class AppointmentCompleted implements DomainEvent {
  static readonly eventName = 'scheduling.appointment.completed';

  readonly name = AppointmentCompleted.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly booking: Booking,
  ) {}
}

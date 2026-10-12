import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo';

export class AppointmentCompleted implements DomainEvent {
  readonly name = 'scheduling.appointment.completed';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly booking: Booking,
  ) {}
}

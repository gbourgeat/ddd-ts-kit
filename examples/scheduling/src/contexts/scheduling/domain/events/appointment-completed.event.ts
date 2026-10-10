import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '../value-objects/booking.vo.js';

export class AppointmentCompleted implements DomainEvent {
  readonly name = 'scheduling.appointment.completed';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly booking: Booking,
  ) {}
}

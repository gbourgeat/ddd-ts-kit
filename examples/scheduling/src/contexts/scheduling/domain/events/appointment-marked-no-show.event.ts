import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '../value-objects/booking.vo.js';

export class AppointmentMarkedNoShow implements DomainEvent {
  readonly name = 'scheduling.appointment.marked-no-show';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly booking: Booking,
  ) {}
}

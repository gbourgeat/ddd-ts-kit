import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo.js';

export class AppointmentExpired implements DomainEvent {
  readonly name = 'scheduling.appointment.expired';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** What the appointment held: its slot is free again. */
    readonly booking: Booking,
  ) {}
}

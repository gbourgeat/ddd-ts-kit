import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '@/contexts/scheduling/domain/calendars/value-objects/booking.vo';

export class AppointmentMarkedNoShow implements DomainEvent {
  static readonly eventName = 'scheduling.appointment.marked-no-show';

  readonly name = AppointmentMarkedNoShow.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly booking: Booking,
  ) {}
}

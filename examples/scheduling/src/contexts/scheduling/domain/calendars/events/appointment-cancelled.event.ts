import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '@/contexts/scheduling/domain/calendars/value-objects/booking.vo';
import type { Cancellation } from '@/contexts/scheduling/domain/calendars/value-objects/cancellation.vo';

export class AppointmentCancelled implements DomainEvent {
  static readonly eventName = 'scheduling.appointment.cancelled';

  readonly name = AppointmentCancelled.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** What the appointment held, free again, and who cancelled it. */
    readonly ended: { readonly booking: Booking; readonly cancellation: Cancellation },
  ) {}
}

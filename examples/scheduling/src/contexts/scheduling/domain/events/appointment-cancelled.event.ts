import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo';
import type { Cancellation } from '@/contexts/scheduling/domain/value-objects/cancellation.vo';

export class AppointmentCancelled implements DomainEvent {
  readonly name = 'scheduling.appointment.cancelled';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** What the appointment held, free again, and who cancelled it. */
    readonly ended: { readonly booking: Booking; readonly cancellation: Cancellation },
  ) {}
}

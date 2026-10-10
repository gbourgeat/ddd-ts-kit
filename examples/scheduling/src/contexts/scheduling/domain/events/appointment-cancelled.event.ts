import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '../value-objects/booking.vo.js';
import type { Cancellation } from '../value-objects/cancellation.vo.js';

export class AppointmentCancelled implements DomainEvent {
  readonly name = 'scheduling.appointment.cancelled';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** What the appointment held, free again, and who cancelled it. */
    readonly ended: { readonly booking: Booking; readonly cancellation: Cancellation },
  ) {}
}

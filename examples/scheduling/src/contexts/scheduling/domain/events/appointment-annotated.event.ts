import type { DomainEvent } from '@ddd-ts-kit/kernel';
import type { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo';

/**
 * The staff of the practice wrote an internal note on the appointment: what they keep about it,
 * never shown to its patient. It carries what is held with it, as the booking does, so that a
 * reader who meets the note before the booking still knows the whole appointment.
 */
export class AppointmentAnnotated implements DomainEvent {
  static readonly eventName = 'scheduling.appointment.annotated';

  readonly name = AppointmentAnnotated.eventName;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    /** The note, what is held, and the instant before which it must be confirmed when the appointment is only requested. */
    readonly annotated: { readonly internalNote: string; readonly booking: Booking; readonly confirmBefore?: Date },
  ) {}
}

import { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate';
import type { Calendar } from '@/contexts/scheduling/domain/aggregates/calendar.aggregate';
import { PatientLimitReached } from '@/contexts/scheduling/domain/errors/patient-limit-reached.error';
import { SlotTaken } from '@/contexts/scheduling/domain/errors/slot-taken.error';
import { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo';
import type { Slot } from '@/contexts/scheduling/domain/value-objects/slot.vo';

/** What is already held when a slot is asked for: around it on the calendar, and by the patient with the practitioner. */
interface Held {
  readonly onCalendar: readonly Appointment[];
  readonly byPatient: readonly Appointment[];
}

/**
 * Says whether a slot can be taken on a calendar, given what the calendar already holds, and takes
 * it. The calendar answers for its availability, the appointments for what they hold; the storage
 * has the last word between two bookings that read the same free slot at the same time.
 */
export class SchedulerService {
  /** A booked appointment, or a requested one with its deadline when the type needs a confirmation. */
  book(
    wish: {
      readonly id: string;
      readonly patientId: string;
      readonly appointmentTypeId: string;
      readonly startsAt: Date;
      readonly now: Date;
    },
    calendar: Calendar,
    held: Held,
  ): Appointment {
    const { id, patientId, appointmentTypeId, now } = wish;
    const slot = this.freeSlot({ appointmentTypeId, patientId, startsAt: wish.startsAt, now }, calendar, held);

    const booking = Booking.create({
      calendarId: calendar.id,
      practiceId: calendar.practiceId,
      practitionerId: calendar.practitionerId,
      patientId,
      appointmentTypeId,
      slot,
      day: calendar.timeZone.dayOf(slot.startsAt),
    });

    const confirmBefore = calendar.confirmationDeadlineFor(appointmentTypeId, now);

    return confirmBefore === undefined
      ? Appointment.create(id, booking, now)
      : Appointment.request(id, booking, { now, confirmBefore });
  }

  /** Moves the appointment to another start on its calendar, checked like a booking; what it holds itself does not stand in its way. */
  reschedule(
    wish: { readonly appointment: Appointment; readonly startsAt: Date; readonly now: Date },
    calendar: Calendar,
    held: Held,
  ): void {
    const { appointment, startsAt, now } = wish;

    const others: Held = {
      onCalendar: held.onCalendar.filter((other) => other.id !== appointment.id),
      byPatient: held.byPatient.filter((other) => other.id !== appointment.id),
    };

    const slot = this.freeSlot(
      { appointmentTypeId: appointment.booking.appointmentTypeId, patientId: appointment.patientId, startsAt, now },
      calendar,
      others,
    );

    appointment.reschedule(slot, calendar.timeZone.dayOf(slot.startsAt), now);
  }

  private freeSlot(
    wish: {
      readonly appointmentTypeId: string;
      readonly patientId: string;
      readonly startsAt: Date;
      readonly now: Date;
    },
    calendar: Calendar,
    held: Held,
  ): Slot {
    const slot = calendar.slotFor(wish.appointmentTypeId, wish.startsAt, wish.now);

    if (held.onCalendar.some((other) => other.calendarId === calendar.id && other.holds(slot))) {
      throw SlotTaken.forCalendar(calendar.id, slot.startsAt);
    }

    const coming = held.byPatient.filter(
      (other) =>
        other.patientId === wish.patientId &&
        other.booking.practitionerId === calendar.practitionerId &&
        other.isHeldAfter(wish.now),
    );

    if (coming.length >= calendar.limit) {
      throw PatientLimitReached.atLimit(calendar.limit);
    }

    return slot;
  }
}

import { type Clock, type IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Appointment } from '@/contexts/scheduling/domain/aggregates/appointment.aggregate';
import type { Calendar } from '@/contexts/scheduling/domain/aggregates/calendar.aggregate';
import { Waitlist } from '@/contexts/scheduling/domain/aggregates/waitlist.aggregate';
import { UnknownCalendar } from '@/contexts/scheduling/domain/errors/unknown-calendar.error';
import type { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import type { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import type { WaitlistRepository } from '@/contexts/scheduling/domain/repositories/waitlist.repository';
import { Booking } from '@/contexts/scheduling/domain/value-objects/booking.vo';
import type { Offer } from '@/contexts/scheduling/domain/value-objects/offer.vo';
import { Slot } from '@/contexts/scheduling/domain/value-objects/slot.vo';
import { OfferFreedSlotCommand } from '@/contexts/scheduling/application/commands/offer-freed-slot/offer-freed-slot.command';

/**
 * The waitlist decides who the freed slot goes to; the offer is then a requested appointment
 * that holds the slot until the offer expires. Both are saved in the unit of work of the
 * command: a waiter never leaves the waitlist without the slot being held for them.
 */
@CommandHandler(OfferFreedSlotCommand)
export class OfferFreedSlotHandler implements CommandHandler<OfferFreedSlotCommand> {
  constructor(
    private readonly waitlistRepository: WaitlistRepository,
    private readonly calendarRepository: CalendarRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute({ calendarId, freed }: OfferFreedSlotCommand): Promise<string | undefined> {
    const calendar = await this.calendarRepository.findById(calendarId);

    if (calendar === undefined) {
      throw UnknownCalendar.forCalendar(calendarId);
    }

    const slot = Slot.between(freed.startsAt, freed.endsAt, freed.heldUntil);

    const waitlist = await this.waitlistRepository.findById(
      Waitlist.idOf(calendarId, calendar.timeZone.dayOf(slot.startsAt)),
    );

    const held = await this.appointmentRepository.heldOn(calendarId, slot.startsAt, slot.heldUntil);
    const now = this.clock.now();
    const offer = waitlist?.offer({ slot, calendar, held: held.map((appointment) => appointment.slot) }, now);

    if (waitlist === undefined || offer === undefined) {
      return undefined;
    }

    const requested = Appointment.request(this.ids.next(), bookingOf(offer, calendar), {
      now,
      confirmBefore: offer.expiresAt,
    });

    await this.waitlistRepository.save(waitlist);
    await this.appointmentRepository.save(requested);

    return requested.id;
  }
}

function bookingOf({ waiter, slot }: Offer, calendar: Calendar): Booking {
  return Booking.create({
    calendarId: calendar.id,
    practiceId: calendar.practiceId,
    practitionerId: calendar.practitionerId,
    patientId: waiter.patientId,
    appointmentTypeId: waiter.appointmentTypeId,
    slot,
    day: calendar.timeZone.dayOf(slot.startsAt),
  });
}

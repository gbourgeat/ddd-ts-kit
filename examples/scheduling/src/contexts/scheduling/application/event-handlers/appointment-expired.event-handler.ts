import { type CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentExpired } from '@/contexts/scheduling/domain/events/appointment-expired.event';
import { OfferFreedSlotCommand } from '@/contexts/scheduling/application/commands/offer-freed-slot/offer-freed-slot.command';

/** When a requested appointment expires, the slot it held is offered to the waitlist of its calendar and day: after an offer nobody confirmed, to the next waiter. */
@DomainEventHandler(AppointmentExpired, { name: AppointmentExpired.eventName })
export class AppointmentExpiredEventHandler implements DomainEventHandler<AppointmentExpired> {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentExpired): Promise<void> {
    const { calendarId, slot } = event.booking;
    const freed = { startsAt: slot.startsAt, endsAt: slot.endsAt, heldUntil: slot.heldUntil };

    await this.commands.execute(
      new OfferFreedSlotCommand(systemActor('scheduling.offer-freed-slot'), calendarId, freed),
    );
  }
}

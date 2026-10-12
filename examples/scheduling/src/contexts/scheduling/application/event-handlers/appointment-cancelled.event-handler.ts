import { type CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentCancelled } from '@/contexts/scheduling/domain/events/appointment-cancelled.event';
import { OfferFreedSlotCommand } from '@/contexts/scheduling/application/commands/offer-freed-slot/offer-freed-slot.command';

/** When an appointment is cancelled, the slot it held is offered to the waitlist of its calendar and day. */
@DomainEventHandler(AppointmentCancelled, { name: 'scheduling.appointment.cancelled' })
export class AppointmentCancelledEventHandler implements DomainEventHandler<AppointmentCancelled> {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentCancelled): Promise<void> {
    const { calendarId, slot } = event.ended.booking;
    const freed = { startsAt: slot.startsAt, endsAt: slot.endsAt, heldUntil: slot.heldUntil };

    await this.commands.execute(
      new OfferFreedSlotCommand(systemActor('scheduling.offer-freed-slot'), calendarId, freed),
    );
  }
}

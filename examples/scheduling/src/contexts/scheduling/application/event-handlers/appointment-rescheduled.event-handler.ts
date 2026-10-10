import { CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentRescheduled } from '../../domain/events/appointment-rescheduled.event.js';
import { OfferFreedSlotCommand } from '../commands/offer-freed-slot/offer-freed-slot.command.js';

/** When an appointment moves, the slot it held before is offered to the waitlist of its calendar and day. */
@DomainEventHandler(AppointmentRescheduled, { name: 'scheduling.appointment.rescheduled' }, [CommandBus])
export class AppointmentRescheduledEventHandler implements DomainEventHandler<AppointmentRescheduled> {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentRescheduled): Promise<void> {
    const { calendarId, slot } = event.moved.previous;
    const freed = { startsAt: slot.startsAt, endsAt: slot.endsAt, heldUntil: slot.heldUntil };

    await this.commands.execute(new OfferFreedSlotCommand(systemActor('scheduling.offer-freed-slot'), calendarId, freed));
  }
}

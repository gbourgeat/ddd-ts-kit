import { type CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentCancelled } from '@/contexts/scheduling/domain/events/appointment-cancelled.event';
import { NoteCancellationCommand } from '@/contexts/scheduling/application/commands/note-cancellation/note-cancellation.command';
import { OfferFreedSlotCommand } from '@/contexts/scheduling/application/commands/offer-freed-slot/offer-freed-slot.command';

/**
 * When an appointment is cancelled, the slot it held is offered to the waitlist of its calendar
 * and day; when the patient cancelled it, their attendance record notes it, with their words.
 */
@DomainEventHandler(AppointmentCancelled)
export class AppointmentCancelledEventHandler implements DomainEventHandler<AppointmentCancelled> {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentCancelled): Promise<void> {
    const { calendarId, slot } = event.ended.booking;
    const freed = { startsAt: slot.startsAt, endsAt: slot.endsAt, heldUntil: slot.heldUntil };

    await this.commands.execute(
      new OfferFreedSlotCommand(systemActor('scheduling.offer-freed-slot'), calendarId, freed),
    );

    if (event.ended.cancellation.by === 'patient') {
      await this.noteCancellation(event);
    }
  }

  private async noteCancellation({ aggregateId, ended }: AppointmentCancelled): Promise<void> {
    const { practiceId, patientId, slot } = ended.booking;

    await this.commands.execute(
      new NoteCancellationCommand(
        systemActor('scheduling.note-attendance'),
        practiceId,
        patientId,
        { id: aggregateId, startsAt: slot.startsAt },
        ended.cancellation.reason,
      ),
    );
  }
}

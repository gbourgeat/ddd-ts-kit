import { type CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { NoteCancellationCommand } from '@/contexts/scheduling/application/calendars/commands/note-cancellation/note-cancellation.command';
import { AppointmentCancelled } from '@/contexts/scheduling/domain/calendars/events/appointment-cancelled.event';

/** When the patient cancelled an appointment, their attendance record notes it, with their words. */
@DomainEventHandler(AppointmentCancelled)
export class AttendanceOnCancelledEventHandler implements DomainEventHandler<AppointmentCancelled> {
  constructor(private readonly commands: CommandBus) {}

  async handle({ aggregateId, ended }: AppointmentCancelled): Promise<void> {
    if (ended.cancellation.by !== 'patient') {
      return;
    }

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

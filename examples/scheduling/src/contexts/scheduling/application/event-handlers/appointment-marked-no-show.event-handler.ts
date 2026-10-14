import { type CommandBus, systemActor } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentMarkedNoShow } from '@/contexts/scheduling/domain/events/appointment-marked-no-show.event';
import { NoteNoShowCommand } from '@/contexts/scheduling/application/commands/note-no-show/note-no-show.command';

/** When an appointment is marked as a no-show, the attendance record of its patient notes it, in the same unit of work. */
@DomainEventHandler(AppointmentMarkedNoShow)
export class AppointmentMarkedNoShowEventHandler implements DomainEventHandler<AppointmentMarkedNoShow> {
  constructor(private readonly commands: CommandBus) {}

  async handle(event: AppointmentMarkedNoShow): Promise<void> {
    const { practiceId, patientId, slot } = event.booking;

    await this.commands.execute(
      new NoteNoShowCommand(
        systemActor('scheduling.note-attendance'),
        practiceId,
        patientId,
        event.aggregateId,
        slot.startsAt,
      ),
    );
  }
}

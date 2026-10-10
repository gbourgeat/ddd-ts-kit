import { Clock, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownCalendarError } from '#src/contexts/scheduling/domain/errors/unknown-calendar.error.js';
import { AppointmentRepository } from '#src/contexts/scheduling/domain/repositories/appointment.repository.js';
import { CalendarRepository } from '#src/contexts/scheduling/domain/repositories/calendar.repository.js';
import { TimeOff } from '#src/contexts/scheduling/domain/value-objects/time-off.vo.js';
import { AddTimeOffCommand } from '#src/contexts/scheduling/application/commands/add-time-off/add-time-off.command.js';

@CommandHandler(AddTimeOffCommand, [CalendarRepository, AppointmentRepository, Clock])
export class AddTimeOffHandler implements CommandHandler<AddTimeOffCommand> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: AddTimeOffCommand): Promise<string> {
    const target = await this.calendarRepository.findById(command.calendarId);

    if (target === undefined) {
      throw new UnknownCalendarError(command.calendarId);
    }

    const timeOff = unwrap(TimeOff.create(command.startsAt, command.endsAt));
    const held = await this.appointmentRepository.heldOn(target.id, timeOff.startsAt, timeOff.endsAt);

    target.addTimeOff(
      timeOff,
      held.map((appointment) => appointment.slot),
      this.clock.now(),
    );

    await this.calendarRepository.save(target);

    return target.id;
  }
}

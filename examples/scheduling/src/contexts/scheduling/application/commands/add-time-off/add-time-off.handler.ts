import { Clock, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownCalendarError } from '@/contexts/scheduling/domain/errors/unknown-calendar.error';
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { TimeOff } from '@/contexts/scheduling/domain/value-objects/time-off.vo';
import { AddTimeOffCommand } from '@/contexts/scheduling/application/commands/add-time-off/add-time-off.command';

@CommandHandler(AddTimeOffCommand)
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

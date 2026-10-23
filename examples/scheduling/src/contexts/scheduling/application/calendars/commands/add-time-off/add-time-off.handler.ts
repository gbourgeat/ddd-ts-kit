import { type Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownCalendar } from '@/contexts/scheduling/domain/calendars/errors/unknown-calendar.error';
import type { AppointmentRepository } from '@/contexts/scheduling/domain/calendars/repositories/appointment.repository';
import type { CalendarRepository } from '@/contexts/scheduling/domain/calendars/repositories/calendar.repository';
import { TimeOff } from '@/contexts/scheduling/domain/calendars/value-objects/time-off.vo';
import { AddTimeOffCommand } from '@/contexts/scheduling/application/calendars/commands/add-time-off/add-time-off.command';

@CommandHandler(AddTimeOffCommand)
export class AddTimeOffHandler implements CommandHandler<AddTimeOffCommand> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: AddTimeOffCommand): Promise<string> {
    const calendar = await this.calendarRepository.findById(command.calendarId);

    if (calendar === undefined) {
      throw UnknownCalendar.forCalendar(command.calendarId);
    }

    const timeOff = TimeOff.create(command.startsAt, command.endsAt);
    const held = await this.appointmentRepository.heldOn(calendar.id, timeOff.startsAt, timeOff.endsAt);

    calendar.addTimeOff(
      timeOff,
      held.map((appointment) => appointment.slot),
      this.clock.now(),
    );

    await this.calendarRepository.save(calendar);

    return calendar.id;
  }
}

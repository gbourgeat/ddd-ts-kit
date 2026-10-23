import { type Clock, type IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownCalendar } from '@/contexts/scheduling/domain/calendars/errors/unknown-calendar.error';
import type { CalendarRepository } from '@/contexts/scheduling/domain/calendars/repositories/calendar.repository';
import { AppointmentType } from '@/contexts/scheduling/domain/calendars/value-objects/appointment-type.vo';
import { DefineAppointmentTypeCommand } from '@/contexts/scheduling/application/calendars/commands/define-appointment-type/define-appointment-type.command';

/** Answers the identifier of the appointment type, which a booking names. */
@CommandHandler(DefineAppointmentTypeCommand)
export class DefineAppointmentTypeHandler implements CommandHandler<DefineAppointmentTypeCommand> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: DefineAppointmentTypeCommand): Promise<string> {
    const calendar = await this.calendarRepository.findById(command.calendarId);

    if (calendar === undefined) {
      throw UnknownCalendar.forCalendar(command.calendarId);
    }

    const appointmentType = AppointmentType.create({ ...command.facts, id: this.ids.next() });

    calendar.defineAppointmentType(appointmentType, this.clock.now());

    await this.calendarRepository.save(calendar);

    return appointmentType.id;
  }
}

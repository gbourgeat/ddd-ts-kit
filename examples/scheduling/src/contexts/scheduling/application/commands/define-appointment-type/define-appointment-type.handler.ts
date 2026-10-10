import { Clock, IdGenerator, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownCalendarError } from '#src/contexts/scheduling/domain/errors/unknown-calendar.error.js';
import { CalendarRepository } from '#src/contexts/scheduling/domain/repositories/calendar.repository.js';
import { AppointmentType } from '#src/contexts/scheduling/domain/value-objects/appointment-type.vo.js';
import { DefineAppointmentTypeCommand } from '#src/contexts/scheduling/application/commands/define-appointment-type/define-appointment-type.command.js';

/** Answers the identifier of the appointment type, which a booking names. */
@CommandHandler(DefineAppointmentTypeCommand, [CalendarRepository, IdGenerator, Clock])
export class DefineAppointmentTypeHandler implements CommandHandler<DefineAppointmentTypeCommand> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: DefineAppointmentTypeCommand): Promise<string> {
    const target = await this.calendarRepository.findById(command.calendarId);

    if (target === undefined) {
      throw new UnknownCalendarError(command.calendarId);
    }

    const appointmentType = unwrap(AppointmentType.create({ ...command.facts, id: this.ids.next() }));

    target.defineAppointmentType(appointmentType, this.clock.now());

    await this.calendarRepository.save(target);

    return appointmentType.id;
  }
}

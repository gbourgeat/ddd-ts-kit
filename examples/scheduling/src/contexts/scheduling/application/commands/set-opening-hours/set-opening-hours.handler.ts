import { Clock, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownCalendarError } from '#src/contexts/scheduling/domain/errors/unknown-calendar.error.js';
import { CalendarRepository } from '#src/contexts/scheduling/domain/repositories/calendar.repository.js';
import { OpeningHours, type Weekday } from '#src/contexts/scheduling/domain/value-objects/opening-hours.vo.js';
import { Range } from '#src/contexts/scheduling/domain/value-objects/range.vo.js';
import { SetOpeningHoursCommand } from '#src/contexts/scheduling/application/commands/set-opening-hours/set-opening-hours.command.js';

@CommandHandler(SetOpeningHoursCommand, [CalendarRepository, Clock])
export class SetOpeningHoursHandler implements CommandHandler<SetOpeningHoursCommand> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: SetOpeningHoursCommand): Promise<string> {
    const target = await this.calendarRepository.findById(command.calendarId);

    if (target === undefined) {
      throw new UnknownCalendarError(command.calendarId);
    }

    target.setOpeningHours(unwrap(OpeningHours.create(weekOf(command))), this.clock.now());

    await this.calendarRepository.save(target);

    return target.id;
  }
}

function weekOf({ ranges }: SetOpeningHoursCommand): Partial<Record<Weekday, readonly Range[]>> {
  const week: Partial<Record<Weekday, Range[]>> = {};

  for (const { weekday, start, end } of ranges) {
    week[weekday] = [...(week[weekday] ?? []), unwrap(Range.create(start, end))];
  }

  return week;
}

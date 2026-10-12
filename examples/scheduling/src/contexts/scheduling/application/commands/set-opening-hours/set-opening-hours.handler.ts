import { Clock, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownCalendarError } from '@/contexts/scheduling/domain/errors/unknown-calendar.error';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { OpeningHours, type Weekday } from '@/contexts/scheduling/domain/value-objects/opening-hours.vo';
import { Range } from '@/contexts/scheduling/domain/value-objects/range.vo';
import { SetOpeningHoursCommand } from '@/contexts/scheduling/application/commands/set-opening-hours/set-opening-hours.command';

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

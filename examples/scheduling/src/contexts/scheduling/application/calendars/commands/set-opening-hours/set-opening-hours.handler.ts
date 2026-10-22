import { type Clock, expectVersion } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownCalendar } from '@/contexts/scheduling/domain/calendars/errors/unknown-calendar.error';
import type { CalendarRepository } from '@/contexts/scheduling/domain/calendars/repositories/calendar.repository';
import { OpeningHours } from '@/contexts/scheduling/domain/calendars/value-objects/opening-hours.vo';
import type { Weekday } from '@/contexts/scheduling/domain/calendars/vocabularies/weekday.vocabulary';
import { Range } from '@/contexts/scheduling/domain/calendars/value-objects/range.vo';
import { SetOpeningHoursCommand } from '@/contexts/scheduling/application/calendars/commands/set-opening-hours/set-opening-hours.command';

@CommandHandler(SetOpeningHoursCommand)
export class SetOpeningHoursHandler implements CommandHandler<SetOpeningHoursCommand> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: SetOpeningHoursCommand): Promise<string> {
    const calendar = await this.calendarRepository.findById(command.calendarId);

    if (calendar === undefined) {
      throw UnknownCalendar.forCalendar(command.calendarId);
    }

    expectVersion(calendar, command.expectedVersion);

    calendar.setOpeningHours(OpeningHours.create(weekOf(command)), this.clock.now());

    await this.calendarRepository.save(calendar);

    return calendar.id;
  }
}

function weekOf({ ranges }: SetOpeningHoursCommand): Partial<Record<Weekday, readonly Range[]>> {
  const week: Partial<Record<Weekday, Range[]>> = {};

  for (const { weekday, start, end } of ranges) {
    week[weekday] = [...(week[weekday] ?? []), Range.create(start, end)];
  }

  return week;
}

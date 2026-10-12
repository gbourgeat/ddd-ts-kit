import { type Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';
import type { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { OpeningHours } from '@/contexts/scheduling/domain/value-objects/opening-hours.vo';
import type { Weekday } from '@/contexts/scheduling/domain/vocabularies/weekday.vocabulary';
import { Range } from '@/contexts/scheduling/domain/value-objects/range.vo';
import { SetOpeningHoursCommand } from '@/contexts/scheduling/application/commands/set-opening-hours/set-opening-hours.command';

@CommandHandler(SetOpeningHoursCommand)
export class SetOpeningHoursHandler implements CommandHandler<SetOpeningHoursCommand> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: SetOpeningHoursCommand): Promise<string> {
    const target = await this.calendarRepository.findById(command.calendarId);

    if (target === undefined) {
      throw CalendarError.unknown(command.calendarId);
    }

    target.setOpeningHours(OpeningHours.create(weekOf(command)), this.clock.now());

    await this.calendarRepository.save(target);

    return target.id;
  }
}

function weekOf({ ranges }: SetOpeningHoursCommand): Partial<Record<Weekday, readonly Range[]>> {
  const week: Partial<Record<Weekday, Range[]>> = {};

  for (const { weekday, start, end } of ranges) {
    week[weekday] = [...(week[weekday] ?? []), Range.create(start, end)];
  }

  return week;
}

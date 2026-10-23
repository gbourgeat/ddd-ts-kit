import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import type { Calendar } from '@/contexts/scheduling/domain/calendars/aggregates/calendar.aggregate';
import { UnknownCalendar } from '@/contexts/scheduling/domain/calendars/errors/unknown-calendar.error';
import type { CalendarRepository } from '@/contexts/scheduling/domain/calendars/repositories/calendar.repository';
import { Weekday } from '@/contexts/scheduling/domain/calendars/vocabularies/weekday.vocabulary';
import { GetOpeningHoursQuery } from '@/contexts/scheduling/application/calendars/queries/get-opening-hours/get-opening-hours.query';
import type { GetOpeningHoursResult } from '@/contexts/scheduling/application/calendars/queries/get-opening-hours/get-opening-hours.result';

const WEEK: readonly Weekday[] = [
  Weekday.Monday,
  Weekday.Tuesday,
  Weekday.Wednesday,
  Weekday.Thursday,
  Weekday.Friday,
  Weekday.Saturday,
  Weekday.Sunday,
];

@QueryHandler(GetOpeningHoursQuery)
export class GetOpeningHoursHandler implements QueryHandler<GetOpeningHoursQuery> {
  constructor(private readonly calendarRepository: CalendarRepository) {}

  async execute({ calendarId }: GetOpeningHoursQuery): Promise<GetOpeningHoursResult> {
    const calendar = await this.calendarRepository.findById(calendarId);

    if (calendar === undefined) {
      throw UnknownCalendar.forCalendar(calendarId);
    }

    return {
      calendarId: calendar.id,
      timeZone: calendar.timeZone.name,
      version: calendar.version,
      ranges: rangesOf(calendar),
    };
  }
}

/** Monday first, as a week is read on a door. */
function rangesOf(calendar: Calendar): GetOpeningHoursResult['ranges'] {
  const { week } = calendar.openingHours;

  return WEEK.flatMap((weekday) => week[weekday].map(({ start, end }) => ({ weekday, start, end })));
}

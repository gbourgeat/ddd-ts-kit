import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import type { Calendar } from '@/contexts/scheduling/domain/aggregates/calendar.aggregate';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';
import type { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import type { Weekday } from '@/contexts/scheduling/domain/value-objects/opening-hours.vo';
import { GetOpeningHoursQuery } from '@/contexts/scheduling/application/queries/get-opening-hours/get-opening-hours.query';
import type { GetOpeningHoursResult } from '@/contexts/scheduling/application/queries/get-opening-hours/get-opening-hours.result';

const WEEK: readonly Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

@QueryHandler(GetOpeningHoursQuery)
export class GetOpeningHoursHandler implements QueryHandler<GetOpeningHoursQuery> {
  constructor(private readonly calendarRepository: CalendarRepository) {}

  async execute({ calendarId }: GetOpeningHoursQuery): Promise<GetOpeningHoursResult> {
    const calendar = await this.calendarRepository.findById(calendarId);

    if (calendar === undefined) {
      throw CalendarError.unknown(calendarId);
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

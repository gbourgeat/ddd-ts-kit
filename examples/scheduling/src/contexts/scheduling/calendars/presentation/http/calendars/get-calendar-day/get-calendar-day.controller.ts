import { CacheScope, Controller, type HttpRequest } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { GetCalendarDayQuery } from '@/contexts/scheduling/calendars/application/queries/get-calendar-day/get-calendar-day.query';
import { GetCalendarDayParams } from '@/contexts/scheduling/calendars/presentation/http/calendars/get-calendar-day/get-calendar-day.params';
import { GetCalendarDayAnswer } from '@/contexts/scheduling/calendars/presentation/http/calendars/get-calendar-day/get-calendar-day.answer';
import type { GetCalendarDaySerializer } from '@/contexts/scheduling/calendars/presentation/http/calendars/get-calendar-day/get-calendar-day.serializer';
import { CalendarsRoutes } from '@/contexts/scheduling/presentation/http/calendars.routes';

const params = classSchema(GetCalendarDayParams);
const answer = classSchema(GetCalendarDayAnswer);

@Controller({
  group: CalendarsRoutes,
  method: 'GET',
  path: '/:calendarId/days/:day',
  summary: 'Get calendar day',
  params,
  response: { status: 200, description: 'The answer.', body: answer },
  errors: ['UNKNOWN_CALENDAR', 'INVALID_DAY'],
  // What this caller may read of the appointments of the day: kept by its browser only, and asked again each time, a 304 when nothing changed.
  cache: { scope: CacheScope.private, maxAge: '0s', mustRevalidate: true, etag: 'representation' },
})
export class GetCalendarDayController {
  constructor(
    private readonly queries: QueryBus,
    private readonly serializer: GetCalendarDaySerializer,
  ) {}

  async handle(request: HttpRequest<{ params: GetCalendarDayParams }>): Promise<GetCalendarDayAnswer> {
    const { calendarId, day } = request.params;
    const shown = await this.queries.execute(new GetCalendarDayQuery(request.actor, calendarId, day));

    return this.serializer.serialize(shown);
  }
}

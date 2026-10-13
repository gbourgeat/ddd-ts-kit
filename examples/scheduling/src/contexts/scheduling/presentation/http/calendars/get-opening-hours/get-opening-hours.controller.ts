import { CacheScope, Controller, Public, type HttpRequest } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { GetOpeningHoursQuery } from '@/contexts/scheduling/application/queries/get-opening-hours/get-opening-hours.query';
import { GetOpeningHoursParams } from '@/contexts/scheduling/presentation/http/calendars/get-opening-hours/get-opening-hours.params';
import { GetOpeningHoursAnswer } from '@/contexts/scheduling/presentation/http/calendars/get-opening-hours/get-opening-hours.answer';

const params = classSchema(GetOpeningHoursParams);
const answer = classSchema(GetOpeningHoursAnswer);

/**
 * The same answer for everybody, read far more often than it changes: kept by every cache, an
 * hour in Varnish, and purged there as soon as the hours of the calendar change.
 */
@Controller({
  tags: ['scheduling'],
  guards: [Public],
  method: 'GET',
  path: '/calendars/:calendarId/opening-hours',
  summary: 'Get opening hours',
  params,
  response: { status: 200, description: 'The weekly hours of the calendar.', body: answer },
  errors: ['UNKNOWN_CALENDAR'],
  cache: {
    scope: CacheScope.public,
    maxAge: '1m',
    sMaxAge: '1h',
    staleWhileRevalidate: '30s',
    staleIfError: '1d',
    etag: { version: 'version' },
    tags: [{ resource: 'calendar', param: 'calendarId' }],
  },
})
export class GetOpeningHoursController {
  constructor(private readonly queries: QueryBus) {}

  async handle(request: HttpRequest<{ params: GetOpeningHoursParams }>): Promise<GetOpeningHoursAnswer> {
    const shown = await this.queries.execute(new GetOpeningHoursQuery(request.params.calendarId));

    return { ...shown, ranges: shown.ranges.map((range) => ({ ...range })) };
  }
}

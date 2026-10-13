import { describe, expect, it } from 'vitest';
import { CacheTagHeader, controllerRoute, createErrorMapper, executeRoute, type RawHeaders } from '@ddd-ts-kit/http';
import { InMemoryQueryBus } from '@ddd-ts-kit/kernel';
import { errorStatuses } from '@/platform/http/error-statuses';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';
import { GetOpeningHoursQuery } from '@/contexts/scheduling/application/queries/get-opening-hours/get-opening-hours.query';
import { GetOpeningHoursController } from '@/contexts/scheduling/presentation/http/calendars/get-opening-hours/get-opening-hours.controller';

const errorMapper = createErrorMapper(errorStatuses);

const hours = {
  calendarId: 'calendar-1',
  timeZone: 'Europe/Paris',
  version: 3,
  ranges: [{ weekday: 'monday' as const, start: '09:00', end: '12:00' }],
};

describe('GET /calendars/:calendarId/opening-hours', () => {
  it('answers the weekly hours to anybody, kept by every cache and filed under the calendar', async () => {
    const response = await answering()('calendar-1');

    expect(response).toMatchObject({ status: 200, body: hours });

    expect(response.headers).toMatchObject({
      'cache-control': 'public, max-age=60, s-maxage=3600, stale-while-revalidate=30, stale-if-error=86400',
      etag: 'W/"3"',
      xkey: 'calendar:calendar-1',
    });
  });

  it('answers 304 without a body to a caller that holds the current version', async () => {
    const response = await answering({ 'if-none-match': 'W/"3"' })('calendar-1');

    expect(response.status).toBe(304);
    expect(response.body).toBeUndefined();
  });

  it('answers 404 to a calendar that does not exist, which no cache keeps', async () => {
    const response = await answering()('calendar-9');

    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

function answering(headers: RawHeaders = {}) {
  const queries = new InMemoryQueryBus().register(GetOpeningHoursQuery, {
    execute: async ({ calendarId }) => {
      if (calendarId !== 'calendar-1') {
        throw CalendarError.unknown(calendarId);
      }

      return hours;
    },
  });

  return (calendarId: string) =>
    executeRoute(
      controllerRoute(new GetOpeningHoursController(queries)),
      { params: { calendarId }, query: {}, headers, body: undefined, raw: undefined },
      { validateResponses: true, errorMapper, cacheTags: { header: CacheTagHeader.xkey } },
    );
}

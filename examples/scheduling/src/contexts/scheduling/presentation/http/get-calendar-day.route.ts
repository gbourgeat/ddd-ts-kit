import { actorOf } from '@ddd-ts-kit/auth';
import { defineRoute, type Route } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { GetCalendarDayQuery } from '@/contexts/scheduling/application/queries/get-calendar-day/get-calendar-day.query';
import type { GetCalendarDayResult } from '@/contexts/scheduling/application/queries/get-calendar-day/get-calendar-day.result';
import { GetCalendarDayParams } from '@/contexts/scheduling/presentation/http/get-calendar-day-params.dto';
import { GetCalendarDayAnswer } from '@/contexts/scheduling/presentation/http/get-calendar-day-answer.dto';

const params = classSchema(GetCalendarDayParams);
const answer = classSchema(GetCalendarDayAnswer);

export function getCalendarDayRoute(queries: QueryBus): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/calendars/:calendarId/days/:day',
      operationId: 'getCalendarDay',
      summary: 'Get calendar day',
      tags: ['scheduling'],
      request: { params },
      responses: { 200: { description: 'The answer.', body: answer } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'UNKNOWN_CALENDAR', 'INVALID_DAY'],
      security: ['bearer'],
    },
    async (input) => {
      const { calendarId, day } = input.params;
      const shown = await queries.execute(new GetCalendarDayQuery(actorOf(input.context.principal), calendarId, day));

      return { status: 200, body: answerOf(shown) };
    },
  );
}

function answerOf(shown: GetCalendarDayResult): GetCalendarDayAnswer {
  return {
    calendarId: shown.calendarId,
    day: shown.day,
    timeZone: shown.timeZone,
    open: shown.open.map(spanOf),
    timeOff: shown.timeOff.map(spanOf),
    appointmentTypes: shown.appointmentTypes.map((appointmentType) => ({ ...appointmentType })),
    busy: shown.busy.map(({ heldUntil, appointment, ...span }) => ({
      ...spanOf(span),
      heldUntil: heldUntil.toISOString(),
      ...(appointment === undefined ? {} : { appointment: { ...appointment } }),
    })),
  };
}

function spanOf({ startsAt, endsAt }: { readonly startsAt: Date; readonly endsAt: Date }): {
  startsAt: string;
  endsAt: string;
} {
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

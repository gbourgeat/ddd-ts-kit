import { Serializer } from '@ddd-ts-kit/http';
import type { GetCalendarDayResult } from '@/contexts/scheduling/application/calendars/queries/get-calendar-day/get-calendar-day.result';
import type { GetCalendarDayAnswer } from '@/contexts/scheduling/presentation/http/calendars/get-calendar-day/get-calendar-day.answer';

/** The one place that turns the day of a calendar into what a client reads: instants as ISO 8601 text. */
@Serializer()
export class GetCalendarDaySerializer implements Serializer<GetCalendarDayResult, GetCalendarDayAnswer> {
  serialize(shown: GetCalendarDayResult): GetCalendarDayAnswer {
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
}

function spanOf({ startsAt, endsAt }: { readonly startsAt: Date; readonly endsAt: Date }): {
  startsAt: string;
  endsAt: string;
} {
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

import { AuthorizedQuery, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import type { GetCalendarDayResult } from '@/contexts/scheduling/application/calendars/queries/get-calendar-day/get-calendar-day.result';

/** One day `YYYY-MM-DD` of a calendar, in the time zone of its practice, as anyone signed in may see it. */
@Requires(schedulingPermissions['calendar.browse'], {
  resource: (query: GetCalendarDayQuery) => ({ type: 'calendar', id: query.calendarId }),
})
export class GetCalendarDayQuery extends AuthorizedQuery<GetCalendarDayResult> {
  constructor(
    actor: Actor,
    readonly calendarId: string,
    readonly day: string,
  ) {
    super(actor);
  }
}

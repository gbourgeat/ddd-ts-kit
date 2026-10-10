import { AuthorizedQuery, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '../../authorization/scheduling.permissions.js';
import type { GetCalendarDayResult } from './get-calendar-day.result.js';

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

import { AuthorizedQuery, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import type { GetClearanceResult } from '@/contexts/scheduling/application/queries/get-clearance/get-clearance.result';

/** How far a clearance of a calendar went, for whoever may clear that calendar. */
@Requires(schedulingPermissions['calendar.clear'], {
  resource: (query: GetClearanceQuery) => ({ type: 'calendar', id: query.calendarId }),
})
export class GetClearanceQuery extends AuthorizedQuery<GetClearanceResult> {
  constructor(
    actor: Actor,
    readonly calendarId: string,
    readonly clearanceId: string,
  ) {
    super(actor);
  }
}

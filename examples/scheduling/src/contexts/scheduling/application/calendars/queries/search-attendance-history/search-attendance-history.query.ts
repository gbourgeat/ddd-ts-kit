import { AuthorizedQuery, type Actor, type Criteria } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import type { AttendanceEntry } from '@/contexts/scheduling/application/calendars/ports/attendance-history.port';
import type { SearchAttendanceHistoryResult } from '@/contexts/scheduling/application/calendars/queries/search-attendance-history/search-attendance-history.result';

/** The history of the attendance of one patient in one practice, for the members of the practice, oldest fact first. */
@Requires(schedulingPermissions['attendance.read'], {
  resource: (query: SearchAttendanceHistoryQuery) => ({ type: 'practice', id: query.practiceId }),
})
export class SearchAttendanceHistoryQuery extends AuthorizedQuery<SearchAttendanceHistoryResult> {
  constructor(
    actor: Actor,
    readonly practiceId: string,
    readonly patientId: string,
    readonly criteria: Criteria<AttendanceEntry>,
  ) {
    super(actor);
  }
}

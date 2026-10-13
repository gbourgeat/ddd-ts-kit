import { scoped } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { AttendanceRecord } from '@/contexts/scheduling/domain/aggregates/attendance-record.aggregate';
import type { AttendanceHistory } from '@/contexts/scheduling/application/ports/attendance-history.port';
import { SearchAttendanceHistoryQuery } from '@/contexts/scheduling/application/queries/search-attendance-history/search-attendance-history.query';
import type { SearchAttendanceHistoryResult } from '@/contexts/scheduling/application/queries/search-attendance-history/search-attendance-history.result';

@QueryHandler(SearchAttendanceHistoryQuery)
export class SearchAttendanceHistoryHandler implements QueryHandler<SearchAttendanceHistoryQuery> {
  constructor(private readonly history: AttendanceHistory) {}

  /** Membership of the practice was asked before this handler; the history read is the one of that practice and patient, in the statement. */
  async execute(query: SearchAttendanceHistoryQuery): Promise<SearchAttendanceHistoryResult> {
    const recordId = AttendanceRecord.idOf(query.practiceId, query.patientId);

    return this.history.search(scoped(query.criteria.where('recordId', 'eq', recordId), { kind: 'all' }));
  }
}

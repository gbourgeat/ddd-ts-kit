import {
  Controller,
  criteriaQuerySchema,
  pageResponse,
  pageSchemaOf,
  type HttpRequest,
  type PageBody,
} from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import type { Infer } from '@ddd-ts-kit/validation';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import {
  attendanceHistoryCriteria,
  type AttendanceEntry,
} from '@/contexts/scheduling/calendars/application/ports/attendance-history.port';
import { SearchAttendanceHistoryQuery } from '@/contexts/scheduling/calendars/application/queries/search-attendance-history/search-attendance-history.query';
import { PracticesRoutes } from '@/contexts/scheduling/presentation/http/practices.routes';
import { SearchAttendanceHistoryLine } from '@/contexts/scheduling/calendars/presentation/http/practices/search-attendance-history/search-attendance-history.line';
import { SearchAttendanceHistoryParams } from '@/contexts/scheduling/calendars/presentation/http/practices/search-attendance-history/search-attendance-history.params';

const params = classSchema(SearchAttendanceHistoryParams);
// The filters (`filter[fact]=no-show`), the sort and the page the history declares; anything else is answered 422.
const query = criteriaQuerySchema(attendanceHistoryCriteria);

const line = classSchema(SearchAttendanceHistoryLine);

@Controller({
  group: PracticesRoutes,
  method: 'GET',
  path: '/:practiceId/patients/:patientId/attendance',
  summary: 'Search attendance history',
  params,
  query,
  response: { status: 200, description: 'One page of the history, oldest fact first.', body: pageSchemaOf(line) },
  errors: ['INVALID_CRITERIA'],
})
export class SearchAttendanceHistoryController {
  constructor(private readonly queries: QueryBus) {}

  async handle(
    request: HttpRequest<{ params: SearchAttendanceHistoryParams; query: Infer<typeof query> }>,
  ): Promise<PageBody<SearchAttendanceHistoryLine>> {
    const { practiceId, patientId } = request.params;

    const page = await this.queries.execute(
      new SearchAttendanceHistoryQuery(request.actor, practiceId, patientId, request.query),
    );

    return pageResponse(page, lineOf);
  }
}

function lineOf(entry: AttendanceEntry): SearchAttendanceHistoryLine {
  return {
    version: entry.version,
    fact: entry.fact,
    notedAt: entry.notedAt.toISOString(),
    ...(entry.appointmentId === null ? {} : { appointmentId: entry.appointmentId }),
    ...(entry.startsAt === null ? {} : { startsAt: entry.startsAt.toISOString() }),
    ...(entry.reason === null ? {} : { reason: entry.reason }),
  };
}

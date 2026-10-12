import {
  Controller,
  criteriaQuerySchema,
  pageResponse,
  pageSchemaOf,
  type HttpRequest,
  type PageBody,
} from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { occupancyCriteria, type Occupancy } from '@/contexts/analytics/application/ports/occupancy-reader.port';
import { SearchOccupancyQuery } from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.query';
import { SearchOccupancyLine } from '@/contexts/analytics/presentation/http/practices/search-occupancy/search-occupancy.line';
import { SearchOccupancyParams } from '@/contexts/analytics/presentation/http/practices/search-occupancy/search-occupancy.params';
import type { Infer } from '@ddd-ts-kit/validation';
import { PracticesRoutes } from '@/contexts/analytics/presentation/http/practices.routes';

const params = classSchema(SearchOccupancyParams);
const query = criteriaQuerySchema(occupancyCriteria);
const line = classSchema(SearchOccupancyLine);

@Controller({
  group: PracticesRoutes,
  method: 'GET',
  path: '/:practiceId/occupancy',
  summary: 'Search occupancy',
  params,
  query,
  response: { status: 200, description: 'One page of the search.', body: pageSchemaOf(line) },
  errors: [],
})
export class SearchOccupancyController {
  constructor(private readonly queries: QueryBus) {}

  async handle(
    request: HttpRequest<{ params: SearchOccupancyParams; query: Infer<typeof query> }>,
  ): Promise<PageBody<SearchOccupancyLine>> {
    const page = await this.queries.execute(
      new SearchOccupancyQuery(request.actor, request.params.practiceId, request.query),
    );

    return pageResponse(page, toLine);
  }
}

function toLine(occupancy: Occupancy): SearchOccupancyLine {
  const {
    id,
    calendarId,
    day,
    heldMinutes,
    appointmentsHeld,
    completed,
    noShows,
    cancelledByPatient,
    cancelledByPractice,
  } = occupancy;

  return {
    id,
    calendarId,
    day,
    heldMinutes,
    appointmentsHeld,
    completed,
    noShows,
    cancelledByPatient,
    cancelledByPractice,
  };
}

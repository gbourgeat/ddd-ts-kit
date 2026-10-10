import { actorOf } from '@ddd-ts-kit/auth';
import { criteriaQuerySchema, defineRoute, pageResponse, pageSchemaOf, type Route } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { occupancyCriteria, type Occupancy } from '@/contexts/analytics/application/ports/occupancy-reader.port.js';
import { SearchOccupancyQuery } from '@/contexts/analytics/application/queries/search-occupancy/search-occupancy.query.js';
import { SearchOccupancyLine } from '@/contexts/analytics/presentation/http/search-occupancy-line.dto.js';
import { SearchOccupancyParams } from '@/contexts/analytics/presentation/http/search-occupancy-params.dto.js';

const params = classSchema(SearchOccupancyParams);
const query = criteriaQuerySchema(occupancyCriteria);
const line = classSchema(SearchOccupancyLine);

export function searchOccupancyRoute(queries: QueryBus): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/practices/:practiceId/occupancy',
      operationId: 'searchOccupancy',
      summary: 'Search occupancy',
      tags: ['analytics'],
      request: { params, query },
      responses: { 200: { description: 'One page of the search.', body: pageSchemaOf(line) } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN'],
      security: ['bearer'],
    },
    async (input) => {
      const page = await queries.execute(
        new SearchOccupancyQuery(actorOf(input.context.principal), input.params.practiceId, input.query),
      );

      return { status: 200, body: pageResponse(page, toLine) };
    },
  );
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

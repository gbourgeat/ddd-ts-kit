import { actorOf } from '@ddd-ts-kit/auth';
import { criteriaQuerySchema, defineRoute, pageResponse, pageSchemaOf, type Route } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { occupancyCriteria, type Occupancy } from '../../application/ports/occupancy-register.port.js';
import { ListOccupancyQuery } from '../../application/queries/list-occupancy/list-occupancy.query.js';
import { ListOccupancyLine } from './list-occupancy-line.dto.js';
import { ListOccupancyParams } from './list-occupancy-params.dto.js';

const params = classSchema(ListOccupancyParams);
const query = criteriaQuerySchema(occupancyCriteria);
const line = classSchema(ListOccupancyLine);

export function listOccupancyRoute(queries: QueryBus): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/practices/:practiceId/occupancy',
      operationId: 'listOccupancy',
      summary: 'List occupancy',
      tags: ['analytics'],
      request: { params, query },
      responses: { 200: { description: 'One page of the list.', body: pageSchemaOf(line) } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN'],
      security: ['bearer'],
    },
    async (input) => {
      const page = await queries.execute(new ListOccupancyQuery(actorOf(input.context.principal), input.params.practiceId, input.query));

      return { status: 200, body: pageResponse(page, toLine) };
    },
  );
}

function toLine(occupancy: Occupancy): ListOccupancyLine {
  const { id, calendarId, day, heldMinutes, appointmentsHeld, completed, noShows, cancelledByPatient, cancelledByPractice } = occupancy;

  return { id, calendarId, day, heldMinutes, appointmentsHeld, completed, noShows, cancelledByPatient, cancelledByPractice };
}

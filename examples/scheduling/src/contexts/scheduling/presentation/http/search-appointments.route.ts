import { actorOf } from '@ddd-ts-kit/auth';
import { criteriaQuerySchema, defineRoute, pageResponse, pageSchemaOf, type Route } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { agendaCriteria, type AgendaEntry } from '@/contexts/scheduling/application/ports/agenda.port';
import { SearchAppointmentsQuery } from '@/contexts/scheduling/application/queries/search-appointments/search-appointments.query';
import { SearchAppointmentsLine } from '@/contexts/scheduling/presentation/http/search-appointments-line.dto';

// The filters (`filter[status]=in:booked,requested`), the sort and the page the agenda declares; anything else is answered 422.
const query = criteriaQuerySchema(agendaCriteria);

const line = classSchema(SearchAppointmentsLine);

export function searchAppointmentsRoute(queries: QueryBus): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/appointments',
      operationId: 'searchAppointments',
      summary: 'Search appointments',
      tags: ['scheduling'],
      request: { query },
      responses: { 200: { description: 'One page of the search.', body: pageSchemaOf(line) } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_CRITERIA'],
      security: ['bearer'],
    },
    async (input) => {
      const page = await queries.execute(new SearchAppointmentsQuery(actorOf(input.context.principal), input.query));

      return { status: 200, body: pageResponse(page, lineOf) };
    },
  );
}

function lineOf(item: AgendaEntry): SearchAppointmentsLine {
  return {
    id: item.id,
    calendarId: item.calendarId,
    practiceId: item.practiceId,
    practitionerId: item.practitionerId,
    patientId: item.patientId,
    appointmentTypeId: item.appointmentTypeId,
    startsAt: item.startsAt.toISOString(),
    endsAt: item.endsAt.toISOString(),
    day: item.day,
    status: item.status,
    ...(item.confirmBefore === null ? {} : { confirmBefore: item.confirmBefore.toISOString() }),
    ...(item.cancelledBy === null ? {} : { cancelledBy: item.cancelledBy }),
  };
}

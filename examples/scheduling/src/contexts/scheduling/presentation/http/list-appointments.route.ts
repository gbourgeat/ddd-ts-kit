import { actorOf } from '@ddd-ts-kit/auth';
import { criteriaQuerySchema, defineRoute, pageResponse, pageSchemaOf, type Route } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { agendaCriteria, type AgendaEntry } from '../../application/ports/agenda.port.js';
import { ListAppointmentsQuery } from '../../application/queries/list-appointments/list-appointments.query.js';
import { ListAppointmentsLine } from './list-appointments-line.dto.js';

// The filters (`filter[status]=in:booked,requested`), the sort and the page the agenda declares; anything else is answered 422.
const query = criteriaQuerySchema(agendaCriteria);

const line = classSchema(ListAppointmentsLine);

export function listAppointmentsRoute(queries: QueryBus): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/appointments',
      operationId: 'listAppointments',
      summary: 'List appointments',
      tags: ['scheduling'],
      request: { query },
      responses: { 200: { description: 'One page of the list.', body: pageSchemaOf(line) } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_CRITERIA'],
      security: ['bearer'],
    },
    async (input) => {
      const page = await queries.execute(new ListAppointmentsQuery(actorOf(input.context.principal), input.query));

      return { status: 200, body: pageResponse(page, lineOf) };
    },
  );
}

function lineOf(item: AgendaEntry): ListAppointmentsLine {
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

import { actorOf } from '@ddd-ts-kit/auth';
import { criteriaQuerySchema, defineRoute, pageResponse, pageSchemaOf, type Route } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { agendaCriteria, type AgendaEntry } from '../../application/ports/agenda.port.js';
import { ListPracticeAgendaQuery } from '../../application/queries/list-practice-agenda/list-practice-agenda.query.js';
import { ListPracticeAgendaLine } from './list-practice-agenda-line.dto.js';
import { ListPracticeAgendaParams } from './list-practice-agenda-params.dto.js';

const params = classSchema(ListPracticeAgendaParams);
// The filters (`filter[day]=2026-03-02`), the sort and the page the agenda declares; anything else is answered 422.
const query = criteriaQuerySchema(agendaCriteria);

const line = classSchema(ListPracticeAgendaLine);

export function listPracticeAgendaRoute(queries: QueryBus): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/practices/:practiceId/agenda',
      operationId: 'listPracticeAgenda',
      summary: 'List practice agenda',
      tags: ['scheduling'],
      request: { params, query },
      responses: { 200: { description: 'One page of the list.', body: pageSchemaOf(line) } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_CRITERIA'],
      security: ['bearer'],
    },
    async (input) => {
      const page = await queries.execute(
        new ListPracticeAgendaQuery(actorOf(input.context.principal), input.params.practiceId, input.query),
      );

      return { status: 200, body: pageResponse(page, lineOf) };
    },
  );
}

function lineOf(item: AgendaEntry): ListPracticeAgendaLine {
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

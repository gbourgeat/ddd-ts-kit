import { actorOf } from '@ddd-ts-kit/auth';
import { criteriaQuerySchema, defineRoute, pageResponse, pageSchemaOf, type Route } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { agendaCriteria, type AgendaEntry } from '@/contexts/scheduling/application/ports/agenda.port';
import { SearchPracticeAgendaQuery } from '@/contexts/scheduling/application/queries/search-practice-agenda/search-practice-agenda.query';
import { SearchPracticeAgendaLine } from '@/contexts/scheduling/presentation/http/search-practice-agenda-line.dto';
import { SearchPracticeAgendaParams } from '@/contexts/scheduling/presentation/http/search-practice-agenda-params.dto';

const params = classSchema(SearchPracticeAgendaParams);
// The filters (`filter[day]=2026-03-02`), the sort and the page the agenda declares; anything else is answered 422.
const query = criteriaQuerySchema(agendaCriteria);

const line = classSchema(SearchPracticeAgendaLine);

export function searchPracticeAgendaRoute(queries: QueryBus): Route {
  return defineRoute(
    {
      method: 'GET',
      path: '/practices/:practiceId/agenda',
      operationId: 'searchPracticeAgenda',
      summary: 'Search practice agenda',
      tags: ['scheduling'],
      request: { params, query },
      responses: { 200: { description: 'One page of the search.', body: pageSchemaOf(line) } },
      errors: ['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_CRITERIA'],
      security: ['bearer'],
    },
    async (input) => {
      const page = await queries.execute(
        new SearchPracticeAgendaQuery(actorOf(input.context.principal), input.params.practiceId, input.query),
      );

      return { status: 200, body: pageResponse(page, lineOf) };
    },
  );
}

function lineOf(item: AgendaEntry): SearchPracticeAgendaLine {
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

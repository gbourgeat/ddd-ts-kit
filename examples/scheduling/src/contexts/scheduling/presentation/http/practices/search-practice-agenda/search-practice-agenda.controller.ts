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
import { agendaCriteria } from '@/contexts/scheduling/application/ports/agenda.port';
import { SearchPracticeAgendaQuery } from '@/contexts/scheduling/application/queries/search-practice-agenda/search-practice-agenda.query';
import { AgendaLine } from '@/contexts/scheduling/presentation/http/shared/agenda-line.schema';
import { SearchPracticeAgendaParams } from '@/contexts/scheduling/presentation/http/practices/search-practice-agenda/search-practice-agenda.params';
import type { Infer } from '@ddd-ts-kit/validation';
import type { AgendaEntrySerializer } from '@/contexts/scheduling/presentation/http/shared/agenda-entry.serializer';
import { PracticesRoutes } from '@/contexts/scheduling/presentation/http/practices.routes';

const params = classSchema(SearchPracticeAgendaParams);
// The filters (`filter[day]=2026-03-02`), the sort and the page the agenda declares; anything else is answered 422.
const query = criteriaQuerySchema(agendaCriteria);

const line = classSchema(AgendaLine, { shared: true });

@Controller({
  group: PracticesRoutes,
  method: 'GET',
  path: '/:practiceId/agenda',
  summary: 'Search practice agenda',
  params,
  query,
  response: { status: 200, description: 'One page of the search.', body: pageSchemaOf(line) },
  errors: ['INVALID_CRITERIA'],
})
export class SearchPracticeAgendaController {
  constructor(
    private readonly queries: QueryBus,
    private readonly serializer: AgendaEntrySerializer,
  ) {}

  async handle(
    request: HttpRequest<{ params: SearchPracticeAgendaParams; query: Infer<typeof query> }>,
  ): Promise<PageBody<AgendaLine>> {
    const page = await this.queries.execute(
      new SearchPracticeAgendaQuery(request.actor, request.params.practiceId, request.query),
    );

    return pageResponse(page, (entry) => this.serializer.serialize(entry));
  }
}

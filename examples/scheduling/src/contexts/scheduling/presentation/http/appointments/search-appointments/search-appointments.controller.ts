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
import { SearchAppointmentsQuery } from '@/contexts/scheduling/application/queries/search-appointments/search-appointments.query';
import { AgendaLine } from '@/contexts/scheduling/presentation/http/shared/agenda-line.schema';
import type { Infer } from '@ddd-ts-kit/validation';
import type { AgendaEntrySerializer } from '@/contexts/scheduling/presentation/http/shared/agenda-entry.serializer';
import { AppointmentsRoutes } from '@/contexts/scheduling/presentation/http/appointments.routes';

// The filters (`filter[status]=in:booked,requested`), the sort and the page the agenda declares; anything else is answered 422.
const query = criteriaQuerySchema(agendaCriteria);

// Shared with the agenda of a practice: one AgendaLine and one AgendaLinePage in the contract.
const line = classSchema(AgendaLine, { shared: true });

@Controller({
  group: AppointmentsRoutes,
  method: 'GET',
  path: '/',
  summary: 'Search appointments',
  query,
  response: { status: 200, description: 'One page of the search.', body: pageSchemaOf(line) },
  errors: ['INVALID_CRITERIA'],
})
export class SearchAppointmentsController {
  constructor(
    private readonly queries: QueryBus,
    private readonly serializer: AgendaEntrySerializer,
  ) {}

  async handle(request: HttpRequest<{ query: Infer<typeof query> }>): Promise<PageBody<AgendaLine>> {
    const page = await this.queries.execute(new SearchAppointmentsQuery(request.actor, request.query));

    return pageResponse(page, (entry) => this.serializer.serialize(entry));
  }
}

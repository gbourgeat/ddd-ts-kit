import { Controller, streamSchemaOf, type HttpRequest } from '@ddd-ts-kit/http';
import type { QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import { ExportPracticeAgendaQuery } from '@/contexts/scheduling/application/queries/export-practice-agenda/export-practice-agenda.query';
import { PracticesRoutes } from '@/contexts/scheduling/presentation/http/practices.routes';
import { ExportPracticeAgendaLine } from '@/contexts/scheduling/presentation/http/practices/export-practice-agenda/export-practice-agenda.line';
import { ExportPracticeAgendaParams } from '@/contexts/scheduling/presentation/http/practices/export-practice-agenda/export-practice-agenda.params';
import type { AgendaEntrySerializer } from '@/contexts/scheduling/presentation/http/shared/agenda-entry.serializer';

const params = classSchema(ExportPracticeAgendaParams);
const line = classSchema(ExportPracticeAgendaLine);

/** The whole agenda of a practice for a spreadsheet or a partner: written row by row as it is read, in CSV or XML as the request accepts. */
@Controller({
  group: PracticesRoutes,
  method: 'GET',
  path: '/:practiceId/agenda/export',
  summary: 'Export practice agenda',
  produces: ['text/csv', 'application/xml'],
  params,
  response: { status: 200, description: 'Every appointment of the agenda, streamed.', body: streamSchemaOf(line) },
  errors: [],
})
export class ExportPracticeAgendaController {
  constructor(
    private readonly queries: QueryBus,
    private readonly serializer: AgendaEntrySerializer,
  ) {}

  async handle(
    request: HttpRequest<{ params: ExportPracticeAgendaParams }>,
  ): Promise<AsyncIterable<ExportPracticeAgendaLine>> {
    const entries = await this.queries.execute(new ExportPracticeAgendaQuery(request.actor, request.params.practiceId));

    return this.lines(entries);
  }

  private async *lines(
    entries: AsyncIterable<Parameters<AgendaEntrySerializer['serialize']>[0]>,
  ): AsyncIterable<ExportPracticeAgendaLine> {
    for await (const entry of entries) {
      yield this.serializer.serialize(entry);
    }
  }
}

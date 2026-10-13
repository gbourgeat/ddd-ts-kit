import { Controller, everyPage, streamSchemaOf, type HttpRequest } from '@ddd-ts-kit/http';
import { Criteria, cursorPage, type QueryBus } from '@ddd-ts-kit/kernel';
import { classSchema } from '@ddd-ts-kit/validation/class-validator';
import type { AgendaEntry } from '@/contexts/scheduling/application/ports/agenda.port';
import { SearchPracticeAgendaQuery } from '@/contexts/scheduling/application/queries/search-practice-agenda/search-practice-agenda.query';
import { PracticesRoutes } from '@/contexts/scheduling/presentation/http/practices.routes';
import { ExportPracticeAgendaParams } from '@/contexts/scheduling/presentation/http/practices/export-practice-agenda/export-practice-agenda.params';
import type { AgendaEntrySerializer } from '@/contexts/scheduling/presentation/http/shared/agenda-entry.serializer';
import { AgendaLine } from '@/contexts/scheduling/presentation/http/shared/agenda-line.schema';

const params = classSchema(ExportPracticeAgendaParams);
const line = classSchema(AgendaLine, { shared: true });

/** The largest page the agenda answers: the export reads it page after page, never more at once. */
const PAGE = 100;

/**
 * The whole agenda of a practice for a spreadsheet or a partner: written row by row as it is read,
 * in CSV or XML as the request accepts. Each page is a search sent through the bus, so each one is
 * authorized, scoped to the calendars of the caller, timed and traced as any query.
 */
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

  async handle(request: HttpRequest<{ params: ExportPracticeAgendaParams }>): Promise<AsyncIterable<AgendaLine>> {
    const { actor, params: asked } = request;

    const entries = everyPage((cursor) =>
      this.queries.execute(new SearchPracticeAgendaQuery(actor, asked.practiceId, pageAt(cursor))),
    );

    return this.lines(entries);
  }

  private async *lines(entries: AsyncIterable<AgendaEntry>): AsyncIterable<AgendaLine> {
    for await (const entry of entries) {
      yield this.serializer.serialize(entry);
    }
  }
}

function pageAt(cursor: string | undefined): Criteria<AgendaEntry> {
  return Criteria.of<AgendaEntry>().page(
    cursor === undefined ? cursorPage({ limit: PAGE }) : cursorPage({ cursor, limit: PAGE }),
  );
}

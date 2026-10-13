import { Access } from '@ddd-ts-kit/auth';
import { Criteria, cursorPage, scoped, type ReadScope } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import type { Agenda, AgendaEntry } from '@/contexts/scheduling/application/ports/agenda.port';
import { ExportPracticeAgendaQuery } from '@/contexts/scheduling/application/queries/export-practice-agenda/export-practice-agenda.query';
import type { ExportPracticeAgendaResult } from '@/contexts/scheduling/application/queries/export-practice-agenda/export-practice-agenda.result';

/** The largest page the agenda answers: the export reads it page after page, never more at once. */
const PAGE = 100;

@QueryHandler(ExportPracticeAgendaQuery)
export class ExportPracticeAgendaHandler implements QueryHandler<ExportPracticeAgendaQuery> {
  constructor(
    private readonly agenda: Agenda,
    private readonly access: Access,
  ) {}

  /** Narrowed, in every statement, to the practice and to the calendars the actor runs; each page is read when the previous one has been written. */
  async execute(query: ExportPracticeAgendaQuery): Promise<ExportPracticeAgendaResult> {
    const scope = await this.access.scope(query.actor, schedulingPermissions['agenda.read'], 'calendar');

    return this.pages(query.practiceId, scope);
  }

  private async *pages(practiceId: string, scope: ReadScope): AsyncIterable<AgendaEntry> {
    const ofThePractice = Criteria.of<AgendaEntry>().where('practiceId', 'eq', practiceId);

    for (let cursor: string | undefined, first = true; first || cursor !== undefined; first = false) {
      const request = cursor === undefined ? cursorPage({ limit: PAGE }) : cursorPage({ cursor, limit: PAGE });
      const page = await this.agenda.search(scoped(ofThePractice.page(request), scope, { ids: 'calendarId' }));

      yield* page.items;
      cursor = page.nextCursor;
    }
  }
}

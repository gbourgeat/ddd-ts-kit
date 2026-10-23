import { Access } from '@ddd-ts-kit/auth';
import { scoped } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import type { Agenda } from '@/contexts/scheduling/calendars/application/ports/agenda.port';
import { SearchPracticeAgendaQuery } from '@/contexts/scheduling/calendars/application/queries/search-practice-agenda/search-practice-agenda.query';
import type { SearchPracticeAgendaResult } from '@/contexts/scheduling/calendars/application/queries/search-practice-agenda/search-practice-agenda.result';

@QueryHandler(SearchPracticeAgendaQuery)
export class SearchPracticeAgendaHandler implements QueryHandler<SearchPracticeAgendaQuery> {
  constructor(
    private readonly agenda: Agenda,
    private readonly access: Access,
  ) {}

  /** Membership of the practice was asked before this handler; here the agenda is narrowed, in the statement, to the practice and to the calendars the actor runs. */
  async execute(query: SearchPracticeAgendaQuery): Promise<SearchPracticeAgendaResult> {
    const scope = await this.access.scope(query.actor, schedulingPermissions['agenda.read'], 'calendar');
    const ofThePractice = query.criteria.where('practiceId', 'eq', query.practiceId);

    return this.agenda.search(scoped(ofThePractice, scope, { ids: 'calendarId' }));
  }
}

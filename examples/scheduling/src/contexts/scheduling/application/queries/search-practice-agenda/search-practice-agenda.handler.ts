import { Access } from '@ddd-ts-kit/auth';
import { scoped } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '../../authorization/scheduling.permissions.js';
import { Agenda } from '../../ports/agenda.port.js';
import { SearchPracticeAgendaQuery } from './search-practice-agenda.query.js';
import type { SearchPracticeAgendaResult } from './search-practice-agenda.result.js';

@QueryHandler(SearchPracticeAgendaQuery, [Agenda, Access])
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

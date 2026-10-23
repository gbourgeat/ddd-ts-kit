import { AuthorizedQuery, type Actor, type Criteria } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import type { AgendaEntry } from '@/contexts/scheduling/calendars/application/ports/agenda.port';
import type { SearchPracticeAgendaResult } from '@/contexts/scheduling/calendars/application/queries/search-practice-agenda/search-practice-agenda.result';

/** The agenda of one practice, for its members: the appointments of the calendars the actor runs. Filters, sort and page are the criteria of the agenda. */
@Requires(schedulingPermissions['agenda.read'], {
  resource: (query: SearchPracticeAgendaQuery) => ({ type: 'practice', id: query.practiceId }),
})
export class SearchPracticeAgendaQuery extends AuthorizedQuery<SearchPracticeAgendaResult> {
  constructor(
    actor: Actor,
    readonly practiceId: string,
    readonly criteria: Criteria<AgendaEntry>,
  ) {
    super(actor);
  }
}

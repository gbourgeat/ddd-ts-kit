import { AuthorizedQuery, type Actor, type Criteria } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '../../authorization/scheduling.permissions.js';
import type { AgendaEntry } from '../../ports/agenda.port.js';
import type { ListPracticeAgendaResult } from './list-practice-agenda.result.js';

/** The agenda of one practice, for its members: the appointments of the calendars the actor runs. Filters, sort and page are the criteria of the agenda. */
@Requires(schedulingPermissions['agenda.read'], {
  resource: (query: ListPracticeAgendaQuery) => ({ type: 'practice', id: query.practiceId }),
})
export class ListPracticeAgendaQuery extends AuthorizedQuery<ListPracticeAgendaResult> {
  constructor(
    actor: Actor,
    readonly practiceId: string,
    readonly criteria: Criteria<AgendaEntry>,
  ) {
    super(actor);
  }
}

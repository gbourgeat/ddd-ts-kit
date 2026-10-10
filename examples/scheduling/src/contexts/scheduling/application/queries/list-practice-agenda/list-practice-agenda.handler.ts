import { Access } from '@ddd-ts-kit/auth';
import { scoped } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '../../authorization/scheduling.permissions.js';
import { Agenda } from '../../ports/agenda.port.js';
import { ListPracticeAgendaQuery } from './list-practice-agenda.query.js';
import type { ListPracticeAgendaResult } from './list-practice-agenda.result.js';

@QueryHandler(ListPracticeAgendaQuery, [Agenda, Access])
export class ListPracticeAgendaHandler implements QueryHandler<ListPracticeAgendaQuery> {
  constructor(
    private readonly agenda: Agenda,
    private readonly access: Access,
  ) {}

  /** Membership of the practice was asked before this handler; here the agenda is narrowed, in the statement, to the practice and to the calendars the actor runs. */
  async execute(query: ListPracticeAgendaQuery): Promise<ListPracticeAgendaResult> {
    const scope = await this.access.scope(query.actor, schedulingPermissions['agenda.read'], 'calendar');
    const ofThePractice = query.criteria.where('practiceId', 'eq', query.practiceId);

    return this.agenda.list(scoped(ofThePractice, scope, { ids: 'calendarId' }));
  }
}

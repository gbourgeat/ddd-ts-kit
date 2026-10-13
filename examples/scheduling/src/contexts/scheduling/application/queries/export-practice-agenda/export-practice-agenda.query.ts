import { AuthorizedQuery, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import type { ExportPracticeAgendaResult } from '@/contexts/scheduling/application/queries/export-practice-agenda/export-practice-agenda.result';

/** Every appointment of the agenda of one practice, for its members, in the order they start: read as it is written, never held whole in memory. */
@Requires(schedulingPermissions['agenda.read'], {
  resource: (query: ExportPracticeAgendaQuery) => ({ type: 'practice', id: query.practiceId }),
})
export class ExportPracticeAgendaQuery extends AuthorizedQuery<ExportPracticeAgendaResult> {
  constructor(
    actor: Actor,
    readonly practiceId: string,
  ) {
    super(actor);
  }
}

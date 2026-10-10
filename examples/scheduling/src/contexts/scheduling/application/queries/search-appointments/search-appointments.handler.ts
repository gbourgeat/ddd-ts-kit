import { Access } from '@ddd-ts-kit/auth';
import { scoped } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '#src/contexts/scheduling/application/authorization/scheduling.permissions.js';
import { Agenda } from '#src/contexts/scheduling/application/ports/agenda.port.js';
import { SearchAppointmentsQuery } from '#src/contexts/scheduling/application/queries/search-appointments/search-appointments.query.js';
import type { SearchAppointmentsResult } from '#src/contexts/scheduling/application/queries/search-appointments/search-appointments.result.js';

@QueryHandler(SearchAppointmentsQuery, [Agenda, Access])
export class SearchAppointmentsHandler implements QueryHandler<SearchAppointmentsQuery> {
  constructor(
    private readonly agenda: Agenda,
    private readonly access: Access,
  ) {}

  /** Anybody signed in may list; what the list holds is what they may read, narrowed in the statement and never after loading. */
  async execute(query: SearchAppointmentsQuery): Promise<SearchAppointmentsResult> {
    const scope = await this.access.scope(query.actor, schedulingPermissions['appointment.read'], 'appointment');

    return this.agenda.search(scoped(query.criteria, scope, { ids: 'id' }));
  }
}

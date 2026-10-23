import { Access } from '@ddd-ts-kit/auth';
import { scoped } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import type { Agenda } from '@/contexts/scheduling/calendars/application/ports/agenda.port';
import { SearchAppointmentsQuery } from '@/contexts/scheduling/calendars/application/queries/search-appointments/search-appointments.query';
import type { SearchAppointmentsResult } from '@/contexts/scheduling/calendars/application/queries/search-appointments/search-appointments.result';

@QueryHandler(SearchAppointmentsQuery)
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

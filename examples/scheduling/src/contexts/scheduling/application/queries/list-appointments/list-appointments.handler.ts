import { Access } from '@ddd-ts-kit/auth';
import { scoped } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '../../authorization/scheduling.permissions.js';
import { Agenda } from '../../ports/agenda.port.js';
import { ListAppointmentsQuery } from './list-appointments.query.js';
import type { ListAppointmentsResult } from './list-appointments.result.js';

@QueryHandler(ListAppointmentsQuery, [Agenda, Access])
export class ListAppointmentsHandler implements QueryHandler<ListAppointmentsQuery> {
  constructor(
    private readonly agenda: Agenda,
    private readonly access: Access,
  ) {}

  /** Anybody signed in may list; what the list holds is what they may read, narrowed in the statement and never after loading. */
  async execute(query: ListAppointmentsQuery): Promise<ListAppointmentsResult> {
    const scope = await this.access.scope(query.actor, schedulingPermissions['appointment.read'], 'appointment');

    return this.agenda.list(scoped(query.criteria, scope, { ids: 'id' }));
  }
}

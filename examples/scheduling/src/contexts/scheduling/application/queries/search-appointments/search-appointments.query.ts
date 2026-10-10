import { AuthorizedQuery, type Actor, type Criteria } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '../../authorization/scheduling.permissions.js';
import type { AgendaEntry } from '../../ports/agenda.port.js';
import type { SearchAppointmentsResult } from './search-appointments.result.js';

/** The appointments the actor may read: their own as a patient, those of the calendars they run. Filters, sort and page are the criteria of the agenda. */
@Requires(schedulingPermissions['appointment.search'], { resource: () => ({ type: 'context', id: 'scheduling' }) })
export class SearchAppointmentsQuery extends AuthorizedQuery<SearchAppointmentsResult> {
  constructor(
    actor: Actor,
    readonly criteria: Criteria<AgendaEntry>,
  ) {
    super(actor);
  }
}

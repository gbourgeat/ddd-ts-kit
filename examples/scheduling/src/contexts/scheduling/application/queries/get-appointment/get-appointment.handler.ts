import { Access } from '@ddd-ts-kit/auth';
import { Criteria, hydrate, scoped } from '@ddd-ts-kit/kernel';
import { QueryHandler } from '@ddd-ts-kit/kernel/declarations';
import { AppointmentNotFoundError } from '../../../domain/errors/appointment-not-found.error.js';
import { schedulingPermissions } from '../../authorization/scheduling.permissions.js';
import { Agenda, type AgendaEntry } from '../../ports/agenda.port.js';
import { PersonDirectoryGateway } from '../../ports/person-directory-gateway.port.js';
import { GetAppointmentQuery } from './get-appointment.query.js';
import type { GetAppointmentResult } from './get-appointment.result.js';

/** How long the name of the patient is waited for before the appointment is shown without it. */
const NAME_TIMEOUT_MS = 300;
const UNNAMED = { displayName: '' };

@QueryHandler(GetAppointmentQuery, [Agenda, PersonDirectoryGateway, Access])
export class GetAppointmentHandler implements QueryHandler<GetAppointmentQuery> {
  constructor(
    private readonly agenda: Agenda,
    private readonly people: PersonDirectoryGateway,
    private readonly access: Access,
  ) {}

  /** The appointment is read inside the scope of the actor, then completed with the name of its patient; identity being silent hides the name, never the appointment. */
  async execute(query: GetAppointmentQuery): Promise<GetAppointmentResult> {
    const scope = await this.access.scope(query.actor, schedulingPermissions['appointment.read'], 'appointment');
    const found = await this.agenda.list(scoped(Criteria.of<AgendaEntry>().where('id', 'eq', query.appointmentId), scope, { ids: 'id' }));

    const named = await hydrate(found)
      .with('patient', (entry) => entry.patientId, (personIds) => this.people.namesOf(personIds))
      .orElse('patient', UNNAMED, { onFailure: 'fallback', timeoutMs: NAME_TIMEOUT_MS });

    const [first] = named.items;

    if (first === undefined) throw new AppointmentNotFoundError(query.appointmentId);

    const { patient, ...entry } = first;

    return patient.displayName === '' ? entry : { ...entry, patientName: patient.displayName };
  }
}

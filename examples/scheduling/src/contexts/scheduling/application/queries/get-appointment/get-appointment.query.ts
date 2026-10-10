import { AuthorizedQuery, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '#src/contexts/scheduling/application/authorization/scheduling.permissions.js';
import type { GetAppointmentResult } from '#src/contexts/scheduling/application/queries/get-appointment/get-appointment.result.js';

/** One appointment, for its patient and for whoever runs its calendar, with the name of the patient. */
@Requires(schedulingPermissions['appointment.read'], {
  resource: (query: GetAppointmentQuery) => ({ type: 'appointment', id: query.appointmentId }),
})
export class GetAppointmentQuery extends AuthorizedQuery<GetAppointmentResult> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
  ) {
    super(actor);
  }
}

import { AuthorizedQuery, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';
import type { GetAppointmentResult } from '@/contexts/scheduling/calendars/application/queries/get-appointment/get-appointment.result';

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

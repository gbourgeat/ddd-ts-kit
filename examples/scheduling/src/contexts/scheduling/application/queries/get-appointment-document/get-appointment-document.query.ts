import { AuthorizedQuery, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import type { GetAppointmentDocumentResult } from '@/contexts/scheduling/application/queries/get-appointment-document/get-appointment-document.result';

/** A short link to the document of an appointment. The document may hold health data: every access is recorded in the audit trail. */
@Requires(schedulingPermissions['appointment.read-document'], {
  resource: (query: GetAppointmentDocumentQuery) => ({ type: 'appointment', id: query.appointmentId }),
})
export class GetAppointmentDocumentQuery extends AuthorizedQuery<GetAppointmentDocumentResult> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
  ) {
    super(actor);
  }
}

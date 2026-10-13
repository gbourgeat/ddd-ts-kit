import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';

/** Takes the document off an appointment; its file is deleted once the change is committed. */
@Requires(schedulingPermissions['appointment.remove-document'], {
  resource: (command: RemoveAppointmentDocumentCommand) => ({ type: 'appointment', id: command.appointmentId }),
})
export class RemoveAppointmentDocumentCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
  ) {
    super(actor);
  }
}

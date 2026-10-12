import { AuthorizedCommand, type Actor, type ReceivedFile } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';

/** Attaches a document to an appointment, in place of the one it held: the file arrives still streaming. */
@Requires(schedulingPermissions['appointment.attach-document'], {
  resource: (command: AttachAppointmentDocumentCommand) => ({ type: 'appointment', id: command.appointmentId }),
})
export class AttachAppointmentDocumentCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
    readonly file: ReceivedFile,
  ) {
    super(actor);
  }
}

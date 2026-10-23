import { AuthorizedCommand, FileUpload, type Actor, type ReceivedFile } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';

/** Attaches a document to an appointment, in place of the one it held: the bus stages the file before the transaction opens. */
@Requires(schedulingPermissions['appointment.attach-document'], {
  resource: (command: AttachAppointmentDocumentCommand) => ({ type: 'appointment', id: command.appointmentId }),
})
export class AttachAppointmentDocumentCommand extends AuthorizedCommand<string> {
  readonly document: FileUpload;

  constructor(
    actor: Actor,
    readonly appointmentId: string,
    file: ReceivedFile,
  ) {
    super(actor);
    this.document = new FileUpload(file, 'appointment-documents');
  }
}

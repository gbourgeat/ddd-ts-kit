import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';

/** Records that the patient did not come. */
@Requires(schedulingPermissions['appointment.mark-no-show'], {
  resource: (command: MarkAppointmentNoShowCommand) => ({ type: 'appointment', id: command.appointmentId }),
})
export class MarkAppointmentNoShowCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
  ) {
    super(actor);
  }
}

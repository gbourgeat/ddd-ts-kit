import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';

/** Says that a requested appointment will be honoured. */
@Requires(schedulingPermissions['appointment.confirm'], {
  resource: (command: ConfirmAppointmentCommand) => ({ type: 'appointment', id: command.appointmentId }),
})
export class ConfirmAppointmentCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
  ) {
    super(actor);
  }
}

import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions.js';

/** Says that an appointment took place. */
@Requires(schedulingPermissions['appointment.complete'], {
  resource: (command: CompleteAppointmentCommand) => ({ type: 'appointment', id: command.appointmentId }),
})
export class CompleteAppointmentCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
  ) {
    super(actor);
  }
}

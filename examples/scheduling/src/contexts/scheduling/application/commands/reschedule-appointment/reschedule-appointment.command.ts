import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions.js';

/** Moves an appointment to another start on its calendar, in one step. */
@Requires(schedulingPermissions['appointment.reschedule'], {
  resource: (command: RescheduleAppointmentCommand) => ({ type: 'appointment', id: command.appointmentId }),
})
export class RescheduleAppointmentCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
    readonly startsAt: Date,
  ) {
    super(actor);
  }
}

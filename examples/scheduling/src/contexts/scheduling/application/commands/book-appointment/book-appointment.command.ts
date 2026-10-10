import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '../../authorization/scheduling.permissions.js';

/** Takes a free slot of a calendar for a patient. The patient who books for themselves says so: that is what their role allows. */
@Requires(schedulingPermissions['appointment.book'], {
  resource: (command: BookAppointmentCommand) => ({ type: 'calendar', id: command.calendarId }),
  context: (command: BookAppointmentCommand) => ({ selfService: command.wish.patientId === command.actor.id }),
})
export class BookAppointmentCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly calendarId: string,
    readonly wish: { readonly patientId: string; readonly appointmentTypeId: string; readonly startsAt: Date },
  ) {
    super(actor);
  }
}

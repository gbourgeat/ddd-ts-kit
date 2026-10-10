import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '../../authorization/scheduling.permissions.js';
import type { AppointmentTypeProps } from '../../../domain/value-objects/appointment-type.vo.js';

@Requires(schedulingPermissions['calendar.define-appointment-type'], { resource: (command: DefineAppointmentTypeCommand) => ({ type: 'calendar', id: command.calendarId }) })
export class DefineAppointmentTypeCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly calendarId: string,
    /** The name, then the duration, the grid and the buffer in minutes, and whether an appointment of the type must be confirmed. */
    readonly facts: Omit<AppointmentTypeProps, 'id'>,
  ) {
    super(actor);
  }
}

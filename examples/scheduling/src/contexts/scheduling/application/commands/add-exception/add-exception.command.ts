import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '../../authorization/scheduling.permissions.js';

@Requires(schedulingPermissions['calendar.add-exception'], {
  resource: (command: AddExceptionCommand) => ({ type: 'calendar', id: command.calendarId }),
})
export class AddExceptionCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly calendarId: string,
    /** The day `YYYY-MM-DD` whose hours are replaced. */
    readonly day: string,
    /** The ranges the day is opened on, as their two wall-clock times `HH:MM`; none closes the day. */
    readonly ranges: readonly { readonly start: string; readonly end: string }[],
  ) {
    super(actor);
  }
}

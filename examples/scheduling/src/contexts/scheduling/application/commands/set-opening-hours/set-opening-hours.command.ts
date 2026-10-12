import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';
import type { Weekday } from '@/contexts/scheduling/domain/value-objects/opening-hours.vo';

@Requires(schedulingPermissions['calendar.set-opening-hours'], {
  resource: (command: SetOpeningHoursCommand) => ({ type: 'calendar', id: command.calendarId }),
})
export class SetOpeningHoursCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly calendarId: string,
    /** The ranges of the week, each on its weekday, as their two wall-clock times `HH:MM`. */
    readonly ranges: readonly { readonly weekday: Weekday; readonly start: string; readonly end: string }[],
  ) {
    super(actor);
  }
}

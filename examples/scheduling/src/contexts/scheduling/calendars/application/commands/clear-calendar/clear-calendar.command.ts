import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';

/**
 * Cancels every appointment the calendar holds over a period, before an absence of its
 * practitioner: the work goes to a worker, and the answer is the identifier of the clearance.
 */
@Requires(schedulingPermissions['calendar.clear'], {
  resource: (command: ClearCalendarCommand) => ({ type: 'calendar', id: command.calendarId }),
})
export class ClearCalendarCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly calendarId: string,
    readonly startsAt: Date,
    readonly endsAt: Date,
    readonly reason: string,
  ) {
    super(actor);
  }
}

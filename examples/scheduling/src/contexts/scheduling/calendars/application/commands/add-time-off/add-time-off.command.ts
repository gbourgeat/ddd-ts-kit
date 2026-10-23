import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';

@Requires(schedulingPermissions['calendar.add-time-off'], {
  resource: (command: AddTimeOffCommand) => ({ type: 'calendar', id: command.calendarId }),
})
export class AddTimeOffCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly calendarId: string,
    readonly startsAt: Date,
    readonly endsAt: Date,
  ) {
    super(actor);
  }
}

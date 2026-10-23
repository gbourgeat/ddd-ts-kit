import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/scheduling.permissions';

/** Enters the waitlist of a calendar for a day. The patient who joins for themselves says so: that is what their role allows. */
@Requires(schedulingPermissions['waitlist.join'], {
  resource: (command: JoinWaitlistCommand) => ({ type: 'calendar', id: command.calendarId }),
  context: (command: JoinWaitlistCommand) => ({ selfService: command.wait.patientId === command.actor.id }),
})
export class JoinWaitlistCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly calendarId: string,
    /** Who waits, for which appointment type, and the day `YYYY-MM-DD` waited for in the time zone of the practice. */
    readonly wait: { readonly patientId: string; readonly appointmentTypeId: string; readonly day: string },
  ) {
    super(actor);
  }
}

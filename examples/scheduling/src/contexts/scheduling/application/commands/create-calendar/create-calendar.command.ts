import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { schedulingPermissions } from '@/contexts/scheduling/application/authorization/scheduling.permissions';

@Requires(schedulingPermissions['calendar.create'], {
  resource: (command: CreateCalendarCommand) => ({
    type: 'desk',
    id: `${command.practiceId}.${command.practitionerId}`,
  }),
})
export class CreateCalendarCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly practiceId: string,
    readonly practitionerId: string,
  ) {
    super(actor);
  }
}

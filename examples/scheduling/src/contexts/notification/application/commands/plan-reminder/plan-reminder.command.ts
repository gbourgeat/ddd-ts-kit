import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { notificationPermissions } from '#src/contexts/notification/application/authorization/notification.permissions.js';

@Requires(notificationPermissions['reminder.plan'], { resource: () => ({ type: 'context', id: 'notification' }) })
export class PlanReminderCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly appointment: { readonly appointmentId: string; readonly recipientId: string; readonly startsAt: Date },
  ) {
    super(actor);
  }
}

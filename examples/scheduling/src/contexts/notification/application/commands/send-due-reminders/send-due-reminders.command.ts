import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { notificationPermissions } from '@/contexts/notification/application/authorization/notification.permissions.js';

@Requires(notificationPermissions['reminder.send'], { resource: () => ({ type: 'context', id: 'notification' }) })
export class SendDueRemindersCommand extends AuthorizedCommand<void> {
  /** `asOf` is the instant the reminders are due at: the occurrence of the job, never the instant it really runs. */
  constructor(
    actor: Actor,
    readonly asOf: Date,
  ) {
    super(actor);
  }
}

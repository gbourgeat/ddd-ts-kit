import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { notificationPermissions } from '@/contexts/notification/application/authorization/notification.permissions';

@Requires(notificationPermissions['reminder.withdraw'], { resource: () => ({ type: 'context', id: 'notification' }) })
export class WithdrawReminderCommand extends AuthorizedCommand<void> {
  constructor(
    actor: Actor,
    readonly appointmentId: string,
  ) {
    super(actor);
  }
}

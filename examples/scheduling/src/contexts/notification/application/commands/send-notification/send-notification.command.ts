import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { notificationPermissions } from '#src/contexts/notification/application/authorization/notification.permissions.js';

@Requires(notificationPermissions['notification.send'], { resource: () => ({ type: 'context', id: 'notification' }) })
export class SendNotificationCommand extends AuthorizedCommand<string> {
  /** `cause` names what made the notification necessary: the same cause is told once to each recipient. */
  constructor(
    actor: Actor,
    readonly notice: {
      readonly recipientId: string;
      readonly kind: string;
      readonly appointmentId: string;
      readonly startsAt: Date;
      readonly cause: string;
    },
  ) {
    super(actor);
  }
}

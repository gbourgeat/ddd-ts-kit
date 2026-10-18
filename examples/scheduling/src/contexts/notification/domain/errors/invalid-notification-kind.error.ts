import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { NotificationCodes } from '@/contexts/notification/domain/errors/codes';

export class InvalidNotificationKind extends DomainRefusal {
  readonly code = NotificationCodes.InvalidNotificationKind;

  static forKind(given: string) {
    return InvalidNotificationKind.refusal(
      `"${given}" is not a kind of notification: a request, a confirmation, a rescheduling, a cancellation or a reminder.`,
      { given },
    );
  }
}

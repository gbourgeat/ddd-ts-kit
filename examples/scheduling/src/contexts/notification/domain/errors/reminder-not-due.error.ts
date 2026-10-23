import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { NotificationCodes } from '@/contexts/notification/notification.codes';

export class ReminderNotDue extends DomainRefusal {
  readonly code = NotificationCodes.ReminderNotDue;

  static forReminder(reminderId: string) {
    return ReminderNotDue.refusal(
      `The reminder ${reminderId} is not due: it is sent once, from 24 hours before the start until the start, and only while it is planned.`,
      { reminderId },
    );
  }
}

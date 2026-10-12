import { ConceptError } from '@ddd-ts-kit/kernel';

export class NotificationError extends ConceptError {
  static contactUnknown(recipientId: string) {
    return NotificationError.refusal(
      'CONTACT_UNKNOWN',
      `No contact is known for the recipient ${recipientId}: nothing can be sent to them yet.`,
      { recipientId },
    );
  }

  static invalidNotificationKind(given: string) {
    return NotificationError.refusal(
      'INVALID_NOTIFICATION_KIND',
      `"${given}" is not a kind of notification: a request, a confirmation, a rescheduling, a cancellation or a reminder.`,
      { given },
    );
  }
}

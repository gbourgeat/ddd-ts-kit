import { DomainRefusal } from '@ddd-ts-kit/kernel';
import { NotificationCodes } from '@/contexts/notification/notification.codes';

export class ContactUnknown extends DomainRefusal {
  readonly code = NotificationCodes.ContactUnknown;

  static forRecipient(recipientId: string) {
    return ContactUnknown.refusal(
      `No contact is known for the recipient ${recipientId}: nothing can be sent to them yet.`,
      { recipientId },
    );
  }
}

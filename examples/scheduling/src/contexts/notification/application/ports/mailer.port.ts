import type { Notification } from '@/contexts/notification/domain/aggregates/notification.aggregate';

export abstract class Mailer {
  /** Hands a notification to the mail provider, for the address of its recipient; fails when the provider did not take it. */
  abstract deliver(address: string, notification: Notification): Promise<void>;
}

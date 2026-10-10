import type { Notification } from '#src/contexts/notification/domain/aggregates/notification.aggregate.js';

export abstract class Mailer {
  /** Hands a notification to the mail provider, for the address of its recipient; fails when the provider did not take it. */
  abstract deliver(address: string, notification: Notification): Promise<void>;
}

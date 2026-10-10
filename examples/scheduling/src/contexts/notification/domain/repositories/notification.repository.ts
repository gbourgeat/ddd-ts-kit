import { Repository } from '@ddd-ts-kit/kernel';
import type { Notification } from '#src/contexts/notification/domain/aggregates/notification.aggregate.js';

export abstract class NotificationRepository extends Repository<Notification> {
  /** The notification already sent to this recipient for this cause, if any: a cause is told once to each recipient. */
  abstract findByCause(cause: string, recipientId: string): Promise<Notification | undefined>;
}

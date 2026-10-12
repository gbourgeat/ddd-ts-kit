import { InMemoryRepository, snapshots } from '@ddd-ts-kit/testing';
import { Notification } from '@/contexts/notification/domain/aggregates/notification.aggregate';
import type { NotificationRepository } from '@/contexts/notification/domain/repositories/notification.repository';

export class FakeNotificationRepository extends InMemoryRepository<Notification> implements NotificationRepository {
  constructor() {
    super(
      snapshots({
        toSnapshot: (stored: Notification) => ({ id: stored.id, state: stored.toState() }),
        fromSnapshot: ({ id, state }) => Notification.rehydrate(id, state),
      }),
    );
  }

  async findByCause(cause: string, recipientId: string): Promise<Notification | undefined> {
    return this.all().find((stored) => stored.toState().cause === cause && stored.recipientId === recipientId);
  }
}

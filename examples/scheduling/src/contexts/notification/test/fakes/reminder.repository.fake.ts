import { InMemoryRepository, snapshots } from '@ddd-ts-kit/testing';
import { Reminder } from '#src/contexts/notification/domain/aggregates/reminder.aggregate.js';
import type { ReminderRepository } from '#src/contexts/notification/domain/repositories/reminder.repository.js';

export class FakeReminderRepository extends InMemoryRepository<Reminder> implements ReminderRepository {
  constructor() {
    super(
      snapshots({
        toSnapshot: (stored: Reminder) => ({ id: stored.id, state: stored.toState() }),
        fromSnapshot: ({ id, state }) => Reminder.rehydrate(id, state),
      }),
    );
  }

  async findByAppointment(appointmentId: string): Promise<Reminder | undefined> {
    return this.all().find((stored) => stored.appointmentId === appointmentId);
  }

  async findDue(asOf: Date): Promise<readonly Reminder[]> {
    return this.all()
      .filter((stored) => stored.isDue(asOf))
      .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime() || left.id.localeCompare(right.id));
  }
}

import { Repository } from '@ddd-ts-kit/kernel';
import type { Reminder } from '@/contexts/notification/domain/aggregates/reminder.aggregate.js';

export abstract class ReminderRepository extends Repository<Reminder> {
  abstract findByAppointment(appointmentId: string): Promise<Reminder | undefined>;

  /** The reminders to send at this instant: planned, due, for a start still to come. */
  abstract findDue(asOf: Date): Promise<readonly Reminder[]>;
}

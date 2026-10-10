import { Reminder } from '../../domain/aggregates/reminder.aggregate.js';
import type { ReminderColumns, ReminderRow } from './reminder-row.schema.js';

export const ReminderMapper = {
  toDomain(row: ReminderRow): Reminder {
    const loaded = Reminder.rehydrate(row.id, {
      registeredAt: row.registered_at,
      appointmentId: row.appointment_id,
      recipientId: row.recipient_id,
      startsAt: row.starts_at,
      dueAt: row.due_at,
      status: row.status,
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Reminder): ReminderColumns {
    const state = saved.toState();

    return {
      id: saved.id,
      registered_at: state.registeredAt,
      appointment_id: state.appointmentId,
      recipient_id: state.recipientId,
      starts_at: state.startsAt,
      due_at: state.dueAt,
      status: state.status,
    };
  },
};

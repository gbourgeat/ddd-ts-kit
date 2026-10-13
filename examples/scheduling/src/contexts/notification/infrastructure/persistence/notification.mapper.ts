import { Notification } from '@/contexts/notification/domain/aggregates/notification.aggregate';
import { NotificationKind } from '@/contexts/notification/domain/value-objects/notification-kind.vo';
import type {
  NotificationColumns,
  NotificationRow,
} from '@/contexts/notification/infrastructure/persistence/notification-row.schema';

export const NotificationMapper = {
  toDomain(row: NotificationRow): Notification {
    const loaded = Notification.rehydrate(row.id, {
      registeredAt: row.registered_at,
      recipientId: row.recipient_id,
      kind: NotificationKind.create(row.kind),
      appointmentId: row.appointment_id,
      startsAt: row.starts_at,
      cause: row.cause,
    });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: Notification): NotificationColumns {
    const state = saved.toState();

    return {
      id: saved.id,
      registered_at: state.registeredAt,
      recipient_id: state.recipientId,
      kind: state.kind.value,
      appointment_id: state.appointmentId,
      starts_at: state.startsAt,
      cause: state.cause,
    };
  },
};

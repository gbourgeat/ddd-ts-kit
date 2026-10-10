import type { AuditRow } from '@ddd-ts-kit/knex';

export interface NotificationColumns {
  readonly id: string;
  readonly registered_at: Date;
  readonly recipient_id: string;
  readonly kind: string;
  readonly appointment_id: string;
  readonly starts_at: Date;
  readonly cause: string;
}

export interface NotificationRow extends NotificationColumns, AuditRow {
  readonly version: number;
}

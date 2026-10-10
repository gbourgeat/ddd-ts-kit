import type { AuditRow } from '@ddd-ts-kit/knex';

export interface ReminderColumns {
  readonly id: string;
  readonly registered_at: Date;
  readonly appointment_id: string;
  readonly recipient_id: string;
  readonly starts_at: Date;
  readonly due_at: Date;
  readonly status: 'planned' | 'sent' | 'withdrawn';
}

export interface ReminderRow extends ReminderColumns, AuditRow {
  readonly version: number;
}

import type { AuditRow, TenantRow } from '@ddd-ts-kit/knex';
import type { ReminderStatus } from '@/contexts/notification/domain/vocabularies/reminder-status.vocabulary';

export interface ReminderColumns {
  readonly id: string;
  readonly registered_at: Date;
  readonly appointment_id: string;
  readonly recipient_id: string;
  readonly starts_at: Date;
  readonly due_at: Date;
  readonly status: ReminderStatus;
}

export interface ReminderRow extends ReminderColumns, TenantRow, AuditRow {
  readonly version: number;
}

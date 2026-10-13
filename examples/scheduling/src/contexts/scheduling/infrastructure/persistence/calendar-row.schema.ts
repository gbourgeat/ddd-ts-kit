import type { AuditRow, TenantRow } from '@ddd-ts-kit/knex';

export interface CalendarColumns {
  readonly id: string;
  readonly registered_at: Date;
  readonly practice_id: string;
  readonly practitioner_id: string;
  readonly time_zone: string;
  /** JSON: the ranges of each weekday, each range as its two times `HH:MM`. */
  readonly opening_hours: string;
  /** JSON: each exception as its day and its ranges. */
  readonly exceptions: string;
  /** JSON: each time off as its two instants. */
  readonly time_offs: string;
  /** JSON: each appointment type as its facts. */
  readonly appointment_types: string;
  readonly notice: number;
  readonly horizon: number;
  readonly patient_limit: number;
}

export interface CalendarRow extends CalendarColumns, TenantRow, AuditRow {
  readonly version: number;
}

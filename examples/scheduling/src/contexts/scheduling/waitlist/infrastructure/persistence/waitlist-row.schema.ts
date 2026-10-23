import type { AuditRow, TenantRow } from '@ddd-ts-kit/knex';

export interface WaitlistColumns {
  readonly id: string;
  readonly registered_at: Date;
  readonly calendar_id: string;
  /** The day waited for, `YYYY-MM-DD`. */
  readonly day: string;
  /** JSON: each waiter, in arrival order, as its patient, its appointment type and the instant it joined. */
  readonly waiters: string;
}

export interface WaitlistRow extends WaitlistColumns, TenantRow, AuditRow {
  readonly version: number;
}

import type { AuditRow, TenantRow } from '@ddd-ts-kit/knex';

export interface PersonColumns {
  readonly id: string;
  readonly registered_at: Date;
  readonly display_name: string;
  readonly email: string;
}

export interface PersonRow extends PersonColumns, TenantRow, AuditRow {
  readonly version: number;
}

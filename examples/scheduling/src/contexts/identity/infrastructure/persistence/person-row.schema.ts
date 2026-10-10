import type { AuditRow } from '@ddd-ts-kit/knex';

export interface PersonColumns {
  readonly id: string;
  readonly registered_at: Date;
  readonly display_name: string;
  readonly email: string;
}

export interface PersonRow extends PersonColumns, AuditRow {
  readonly version: number;
}

import type { AuditRow } from '@ddd-ts-kit/knex';

export interface PracticeColumns {
  readonly id: string;
  readonly registered_at: Date;
  readonly name: string;
  readonly time_zone: string;
  /** The memberships of the practice, stored with it as a JSON array: they are part of the aggregate and are never queried on their own. */
  readonly members: string;
}

export interface PracticeRow extends PracticeColumns, AuditRow {
  readonly version: number;
}

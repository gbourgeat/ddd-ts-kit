import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { ReadModelTenant } from './read-model-tenant.js';

export interface DrizzleReadModelOptions<Row> {
  /** The table of the read model, declared with `...readModelColumns()`. */
  readonly table: PgTable;
  /** The column of the key, which is the primary key of the table. */
  readonly key: PgColumn;
  /** The column of every field of the row: `{ startsAt: appointments.startsAt }`. */
  readonly columns: Readonly<Record<keyof Row & string, PgColumn>>;
  /**
   * For a read model of tenant data: every row is written with the tenant of the work in
   * progress, in `column`, and every read and write is confined to it, an elevation widening the
   * reads only. Keys stay unique across tenants (the conflict of an insert is on the key alone):
   * a key that two tenants could share (a day, a slug) is a generated id, or carries the tenant
   * (`acme:2026-03-01`). Absent: one read model for every tenant.
   */
  readonly tenant?: ReadModelTenant;
}

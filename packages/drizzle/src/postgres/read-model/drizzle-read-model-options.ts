import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

export interface DrizzleReadModelOptions<Row> {
  /** The table of the read model, declared with `...readModelColumns()`. */
  readonly table: PgTable;
  /** The column of the key, which is the primary key of the table. */
  readonly key: PgColumn;
  /** The column of every field of the row: `{ startsAt: appointments.startsAt }`. */
  readonly columns: Readonly<Record<keyof Row & string, PgColumn>>;
}

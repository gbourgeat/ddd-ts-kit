import { sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/** A column by its name in the database, quoted. */
export function named(column: PgColumn): SQL {
  return sql`${sql.identifier(column.name)}`;
}

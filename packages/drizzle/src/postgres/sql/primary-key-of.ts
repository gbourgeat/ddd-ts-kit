import { getTableConfig, type PgColumn, type PgTable } from 'drizzle-orm/pg-core';

/**
 * The columns of the primary key of `table`, as its definition declares them (`.primaryKey()`
 * on a column, or `primaryKey({ columns })`): the target of the first save of an aggregate,
 * `onConflictDoNothing({ target: primaryKeyOf(table) })`, so that a row that takes another
 * unique value is refused by the database rather than skipped.
 */
export function primaryKeyOf(table: PgTable): PgColumn[] {
  const { name, columns, primaryKeys } = getTableConfig(table);
  const declared = primaryKeys[0]?.columns ?? columns.filter((column) => column.primary);

  if (declared.length === 0) {
    throw new TypeError(`The table ${name} declares no primary key: the first save has no key to ignore a conflict on`);
  }

  return declared;
}

import type { Knex } from 'knex';
import { UniqueViolationError } from '@ddd-ts-kit/kernel';
import { dialectOf } from './dialect-of';

export interface IgnoringInsert {
  readonly row: Readonly<Record<string, unknown>>;
  /** The column or columns of the key that may already exist. */
  readonly conflict: string | readonly string[];
}

/**
 * Inserts one row unless its key already exists, and says whether it did insert. Unlike
 * catching the unique violation, it leaves the surrounding transaction usable on PostgreSQL.
 * It serves the processed-event store and the first save of an aggregate alike.
 *
 * Only a conflict on `conflict` is ignored, on PostgreSQL and SQLite: a row that takes a value
 * another row holds under another unique constraint (an email) is refused by the database, as
 * any statement would be. MySQL has no conflict target and its `INSERT IGNORE` skips that row
 * too: when it wrote nothing, one query asks whether a row holds the key, and when none does,
 * a `UniqueViolationError` is raised, as the other databases answer.
 *
 * `table` is the query builder of the target table, built on `executor`:
 * `insertIgnoringConflict(db, db('invoices').withSchema('billing'), { row, conflict: 'id' })`.
 */
export async function insertIgnoringConflict(
  executor: Knex,
  table: Knex.QueryBuilder,
  { row, conflict }: IgnoringInsert,
): Promise<boolean> {
  const columns = typeof conflict === 'string' ? [conflict] : [...conflict];
  // Before the insert, which changes the builder: the lookup of the key on MySQL reads the same table.
  const lookup = table.clone();
  const insert = table.insert(row).onConflict(columns).ignore();

  if (dialectOf(executor) === 'mysql') {
    return (await wroteOnMySql(executor, insert)) || keyTaken(lookup, row, columns);
  }

  // RETURNING yields the row only when it was written.
  const inserted: unknown[] = await insert.returning(columns[0] ?? '*');

  return inserted.length === 1;
}

/** Whether a row holds the key of `row`; when none does, the row was skipped for another unique value. */
async function keyTaken(
  lookup: Knex.QueryBuilder,
  row: IgnoringInsert['row'],
  columns: readonly string[],
): Promise<false> {
  const key = Object.fromEntries(columns.map((column) => [column, row[column]]));
  const holder: unknown = await lookup.where(key).first(columns[0] ?? '*');

  if (holder === undefined) {
    throw new UniqueViolationError(columns.map((column) => String(row[column])).join(':'));
  }

  return false;
}

// No RETURNING in MySQL and knex only reports the insert id: the driver's own result header
// is the one place that says whether INSERT IGNORE wrote the row.
async function wroteOnMySql(executor: Knex, insert: Knex.QueryBuilder): Promise<boolean> {
  const { sql, bindings } = insert.toSQL().toNative();
  const result: unknown = await executor.raw(sql, bindings);
  const header: unknown = Array.isArray(result) ? result[0] : result;

  return typeof header === 'object' && header !== null && 'affectedRows' in header && header.affectedRows === 1;
}

import type { Knex } from 'knex';
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
 * `table` is the query builder of the target table, built on `executor`:
 * `insertIgnoringConflict(db, db('invoices').withSchema('billing'), { row, conflict: 'id' })`.
 */
export async function insertIgnoringConflict(
  executor: Knex,
  table: Knex.QueryBuilder,
  { row, conflict }: IgnoringInsert,
): Promise<boolean> {
  const columns = typeof conflict === 'string' ? [conflict] : [...conflict];
  const insert = table.insert(row).onConflict(columns).ignore();

  if (dialectOf(executor) === 'mysql') {
    return wroteOnMySql(executor, insert);
  }

  // RETURNING yields the row only when it was written.
  const inserted: unknown[] = await insert.returning(columns[0] ?? '*');

  return inserted.length === 1;
}

// No RETURNING in MySQL and knex only reports the insert id: the driver's own result header
// is the one place that says whether INSERT IGNORE wrote the row.
async function wroteOnMySql(executor: Knex, insert: Knex.QueryBuilder): Promise<boolean> {
  const { sql, bindings } = insert.toSQL().toNative();
  const result: unknown = await executor.raw(sql, bindings);
  const header: unknown = Array.isArray(result) ? result[0] : result;

  return typeof header === 'object' && header !== null && 'affectedRows' in header && header.affectedRows === 1;
}

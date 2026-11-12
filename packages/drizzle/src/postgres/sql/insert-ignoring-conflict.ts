import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { primaryKeyOf } from './primary-key-of';

/** The insert of one row as the query builder holds it before its conflict clause: `executor.insert(table).values(row)`. */
export interface IgnoringInsertion {
  onConflictDoNothing(config?: { target: PgColumn[] }): {
    returning(fields: Record<string, PgColumn>): PromiseLike<readonly unknown[]>;
  };
}

/**
 * Inserts one row unless its primary key already exists, and says whether it did insert: the
 * first save of an aggregate under `optimisticUpdate`. Unlike catching the unique violation, it
 * leaves the surrounding transaction usable.
 *
 * Only a conflict on the primary key of `table` is ignored (`primaryKeyOf`): a row that takes a
 * value another row holds under another unique constraint (an email) is refused by the database,
 * as any statement would be.
 *
 * That takes two statements at most, which is why the insert is given as a function. A conflict
 * target on the key alone lets two inserts of one key made at once meet on the other unique index
 * first, and one of them is then refused for a value no other row holds. The first statement
 * skips on any unique value; when it wrote nothing, the second names the key: `false` for a key
 * that is held, and the refusal of the database for a value another row holds.
 *
 * `insertIgnoringConflict(() => executor.insert(invoices).values(row), invoices)`: the statement
 * stays written where the row is, with its tenant.
 */
export async function insertIgnoringConflict(insertion: () => IgnoringInsertion, table: PgTable): Promise<boolean> {
  const key = primaryKeyOf(table);
  const returned = Object.fromEntries(key.map((column) => [column.name, column]));

  const wrote = async (conflict?: { target: PgColumn[] }): Promise<boolean> =>
    (await insertion().onConflictDoNothing(conflict).returning(returned)).length === 1;

  return (await wrote()) || wrote({ target: key });
}

import { readModelTableMigration, readModelTablePath } from './read-model-table-migration';
import { liveRowsConstraintOf, type UnreadyReadModelTable } from './unready-read-model-table';

/**
 * The table of a read model has columns that refuse NULL, so it cannot hold the trace of a
 * deleted row: its key, its stamp and `deleted`, NULL in every other column. An adapter raises it
 * from the definition of the table or from one read of its columns, before any statement the
 * database would refuse, since on PostgreSQL that refusal aborts the transaction of the event.
 * Its message names the table, the columns, what is known of the check constraint of the live
 * rows, and the migration to write.
 */
export class ReadModelTableNotReadyError extends Error {
  /** The table as a statement names it: `scheduling.agenda`. */
  readonly table: string;

  /** The columns of the row that refuse NULL. */
  readonly columns: readonly string[];

  /** The statements of the migration to write. */
  readonly migration: string;

  constructor(readonly unready: UnreadyReadModelTable) {
    const table = unready.schema === undefined ? unready.table : `${unready.schema}.${unready.table}`;
    const migration = readModelTableMigration(unready);

    super(
      `The read model table ${table} cannot hold the trace of a deleted row: ${refusalOf(unready)}, and a deleted row keeps its key and its stamp only. ${constraintOf(unready)} The migration to write:\n${migration}`,
    );

    this.name = 'ReadModelTableNotReadyError';
    this.table = table;
    this.columns = unready.refusing;
    this.migration = migration;
  }
}

function refusalOf({ refusing }: UnreadyReadModelTable): string {
  const named = refusing.map((column) => `"${column}"`).join(', ');

  return `${named} ${refusing.length === 1 ? 'refuses' : 'refuse'} NULL`;
}

/** What is known of the check constraint that keeps the live rows whole, in place of the NOT NULL the columns lose. */
function constraintOf(unready: UnreadyReadModelTable): string {
  const name = liveRowsConstraintOf(unready.table);

  if (unready.constraint === undefined) {
    return `The definition the store reads says so: declare these columns nullable there, with the check constraint ${name} that keeps the live rows whole, and ${readModelTablePath(unready)} takes the same in the database.`;
  }

  return unready.constraint
    ? `The check constraint ${name} is there, and does not hold these columns yet.`
    : `The check constraint ${name}, which keeps the live rows whole, is missing.`;
}

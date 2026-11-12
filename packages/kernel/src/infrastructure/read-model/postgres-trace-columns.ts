import { ReadModelTableNotReadyError } from './read-model-table-not-ready-error';
import type { SqlRun } from './sql-run';
import { liveRowsConstraintOf } from './unready-read-model-table';

export interface TracedTable {
  readonly schema?: string;
  readonly table: string;
  /** The columns of the row, in which a trace holds NULL: the key, the tenant and the stamp are not among them. */
  readonly data: readonly string[];
}

/**
 * Whether the table of a read model on PostgreSQL can hold the trace of a deleted row: every
 * column of the row accepts NULL in the database, whatever its definition in the code says. The
 * columns are read once, before the first write of a trace, on the table as a statement would
 * resolve it (the search path when no schema is named), so a table that is not ready is refused
 * by name and not by a statement that would abort the transaction of the event. A refusal reads
 * the check constraint of the table too, to say whether it is missing. The copy of a rebuild is
 * made like the table. Shared by the ORM adapters, which differ only in how they run a statement.
 * `PostgresReadModelTables` asks the same of every table at once, before any store is built.
 */
export class PostgresTraceColumns {
  private ready = false;

  constructor(
    private readonly run: SqlRun,
    private readonly target: () => TracedTable,
  ) {}

  async require(): Promise<void> {
    if (this.ready) {
      return;
    }

    const { schema, table, data } = this.target();
    const path = schema === undefined ? quoted(table) : `${quoted(schema)}.${quoted(table)}`;

    const refusing = await this.run(
      'select attname as "column" from pg_attribute where attrelid = to_regclass($1) and attnotnull and attnum > 0 and not attisdropped',
      [path],
    );

    const named = new Set(refusing.map((row) => row['column']));
    const columns = data.filter((column) => named.has(column));

    if (columns.length > 0) {
      throw new ReadModelTableNotReadyError({
        table,
        refusing: columns,
        row: data,
        constraint: await this.holdsConstraint(path, table),
        ...(schema === undefined ? {} : { schema }),
      });
    }

    this.ready = true;
  }

  /** Asked only of a table that is refused: what its message says of the check constraint. */
  private async holdsConstraint(path: string, table: string): Promise<boolean> {
    const held = await this.run(
      'select conname as "constraint" from pg_constraint where conrelid = to_regclass($1) and contype = \'c\' and conname = $2',
      [path, liveRowsConstraintOf(table)],
    );

    return held.length > 0;
  }
}

function quoted(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

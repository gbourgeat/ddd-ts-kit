import type { Logger } from '../../application/ports/logger';
import { PostgresReadModelRebuild } from './postgres-read-model-rebuild';
import { ReadModelTablesNotReadyError } from './read-model-tables-not-ready-error';
import type { SqlRun } from './sql-run';
import type { UnreadyReadModelTable } from './unready-read-model-table';

export interface ReadModelTablesOptions {
  /**
   * Columns a store never writes NULL in, besides the key, `tenant_id` and the stamp, each as
   * `<schema>.<table>.<column>`: the tenant column of a table that names it otherwise, or a column
   * the store does not map and the database fills (`created_at ... default now()`).
   */
  readonly kept?: readonly string[];
}

/**
 * What an application does at its start with the read model tables that are not ready: `required`
 * refuses to start, `reported` logs them as one error and starts, for a deployment that starts
 * the application before its migrations ran.
 */
export type ReadModelTablesAtStart = 'required' | 'reported';

/** The columns every read model table holds under the same names, on the four ORM: what tells one from another table. */
const STAMP = ['last_event_id', 'last_event_at', 'last_event_version', 'deleted'];

/** The column the tenant of a row is kept in, unless the table names it otherwise. */
const TENANT = 'tenant_id';

/**
 * Every column of every read model table, with what the check needs of each: whether it refuses
 * NULL, whether it is of the primary key, and whether its table holds the check constraint of the
 * live rows. One statement, on the catalog alone: no row of a table is read, and no lock is taken.
 */
const COLUMNS = `select space.nspname as "schema", held.relname as "table", col.attname as "column", col.attnotnull as "refusing",
  exists (select 1 from pg_index as pk where pk.indrelid = held.oid and pk.indisprimary and col.attnum = any (pk.indkey)) as "key",
  exists (select 1 from pg_constraint as whole where whole.conrelid = held.oid and whole.contype = 'c' and whole.conname = left(held.relname || '_live_rows_whole', 63)) as "whole"
from pg_class as held
join pg_namespace as space on space.oid = held.relnamespace
join pg_attribute as col on col.attrelid = held.oid and col.attnum > 0 and not col.attisdropped
where held.relkind in ('r', 'p') and not held.relispartition
  and space.nspname <> 'information_schema' and space.nspname !~ '^pg_'
  and ${String(STAMP.length)} = (select count(*) from pg_attribute as stamp where stamp.attrelid = held.oid and stamp.attnum > 0 and not stamp.attisdropped and stamp.attname in (${STAMP.map((column) => `'${column}'`).join(', ')}))
order by space.nspname, held.relname, col.attnum`;

/**
 * The read model tables of a PostgreSQL database, checked in one pass, whatever builds the stores
 * and whenever it does: each can hold the trace of a deleted row, or is named with its columns and
 * the migration to write. A read model table is known by its stamp, the four columns
 * `readModelColumns` gives it under the same names on every ORM; its row is every other column but
 * the primary key and `tenant_id`. The tables of every schema of the database are read, those of a
 * tenant kept in a schema of its own included; a database per tenant is checked through its own
 * connection. `PostgresTraceColumns` stays the refusal of one store, from the columns it maps.
 */
export class PostgresReadModelTables {
  private readonly kept: ReadonlySet<string>;

  constructor(
    private readonly run: SqlRun,
    options: ReadModelTablesOptions = {},
  ) {
    this.kept = new Set(options.kept);
  }

  /** The tables that cannot hold the trace of a deleted row, every one of them; none when the database is ready. */
  async notReady(): Promise<readonly UnreadyReadModelTable[]> {
    const tables = new Map<string, ReadTable>();

    for (const record of await this.run(COLUMNS, [])) {
      const column = readColumn(record);
      const path = `${column.schema}.${column.table}`;

      const table = tables.get(path) ?? {
        schema: column.schema,
        table: column.table,
        whole: column.whole,
        columns: [],
      };

      tables.set(path, { ...table, columns: [...table.columns, column] });
    }

    return [...tables]
      .filter(([path]) => !isCopyOfARebuild(path, tables))
      .map(([, table]) => this.unreadyOf(table))
      .filter((table) => table.refusing.length > 0);
  }

  /** Refuses with `ReadModelTablesNotReadyError`, which names every table that is not ready and its migration. */
  async require(): Promise<void> {
    const unready = await this.notReady();

    if (unready.length > 0) {
      throw new ReadModelTablesNotReadyError(unready);
    }
  }

  /**
   * The check an application makes when it starts, before a request or an event reaches a store.
   * `required`, the default, refuses to start; `reported` writes the same message as an error
   * and lets the start go on: each store still refuses by name before its first trace.
   */
  async atStart(logger: Logger, unready: ReadModelTablesAtStart = 'required'): Promise<void> {
    if (unready === 'required') {
      return this.require();
    }

    const tables = await this.notReady();

    if (tables.length > 0) {
      const refusal = new ReadModelTablesNotReadyError(tables);

      logger.error(refusal.message, { tables: refusal.tables.map(({ table }) => table).join(', ') });
    }
  }

  private unreadyOf({ schema, table, whole, columns }: ReadTable): UnreadyReadModelTable {
    const row = columns.filter((column) => !this.keeps(column));

    return {
      schema,
      table,
      refusing: row.filter(({ refusing }) => refusing).map(({ column }) => column),
      row: row.map(({ column }) => column),
      constraint: whole,
    };
  }

  /** What a trace keeps: the key, the tenant, the stamp, and what the options name. */
  private keeps({ schema, table, column, key }: ReadColumn): boolean {
    return key || column === TENANT || STAMP.includes(column) || this.kept.has(`${schema}.${table}.${column}`);
  }
}

interface ReadColumn {
  readonly schema: string;
  readonly table: string;
  readonly column: string;
  readonly refusing: boolean;
  readonly key: boolean;
  readonly whole: boolean;
}

/** A read model table as the catalog describes it. */
interface ReadTable {
  readonly schema: string;
  readonly table: string;
  readonly whole: boolean;
  readonly columns: readonly ReadColumn[];
}

function readColumn(record: Readonly<Record<string, unknown>>): ReadColumn {
  return {
    schema: String(record['schema']),
    table: String(record['table']),
    column: String(record['column']),
    refusing: record['refusing'] === true,
    key: record['key'] === true,
    whole: record['whole'] === true,
  };
}

/** The copy a rebuild in progress made like its table: what is said of the table holds for it. */
function isCopyOfARebuild(path: string, tables: ReadonlyMap<string, unknown>): boolean {
  const suffix = PostgresReadModelRebuild.shadowOf('');

  return path.endsWith(suffix) && tables.has(path.slice(0, -suffix.length));
}

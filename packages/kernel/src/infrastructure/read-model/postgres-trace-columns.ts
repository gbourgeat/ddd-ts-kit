import { liveRowsConstraintOf } from './live-rows-constraint-of';
import { ReadModelTableNotReadyError } from './read-model-table-not-ready-error';
import { readModelTableReady } from './read-model-table-ready';
import type { ReadModelTableState } from '../../application/read-model/read-model-table-state';
import type { SqlRun } from './sql-run';

export interface TracedTable {
  readonly schema?: string;
  readonly table: string;
  /** The columns of the row, in which a trace holds NULL: the key, the tenant and the stamp are not among them. */
  readonly data: readonly string[];
  /** The column that marks a deleted row, as the definition of the table names it. Default `deleted`. */
  readonly deleted?: string;
}

/** Every column of the table, as a statement resolves it: what a trace needs to know of each. */
const COLUMNS = `select col.attname as "column", col.attnotnull as "refusing", col.attidentity <> '' as "identity", col.attgenerated <> '' as "generated", exists (select 1 from pg_index as pk where pk.indrelid = col.attrelid and pk.indisprimary and col.attnum = any (pk.indkey)) as "key" from pg_attribute as col where col.attrelid = to_regclass($1) and col.attnum > 0 and not col.attisdropped`;

const CONSTRAINT = `select convalidated as "valid", pg_get_constraintdef(oid) as "definition" from pg_constraint where conrelid = to_regclass($1) and contype = 'c' and conname = $2`;

/**
 * Whether the table of a read model on PostgreSQL can hold the trace of a deleted row, read from
 * the database for the columns the store maps and for no other: each accepts NULL, and none is a
 * part of the primary key, an identity or a generated column, which nothing can open. The table
 * is read as a statement would resolve it (the search path when no schema is named). `require`
 * is the refusal of a store before its first trace, by name and not by a statement that would
 * abort the transaction of the event; it reads once, and the check constraint only for a table
 * it refuses. `state` is the same reading with the constraint, for the tables an application
 * lists and checks when it starts (`ReadModelTables`): one code, so one verdict. The copy of a
 * rebuild is made like the table. Shared by the ORM adapters, which differ only in how they run
 * a statement.
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

    const columns = await this.columns();

    if (!readModelTableReady(columns)) {
      throw new ReadModelTableNotReadyError(columns.exists ? await this.withConstraint(columns) : columns);
    }

    this.ready = true;
  }

  /** What the table can hold and what its check constraint keeps whole. */
  async state(): Promise<ReadModelTableState> {
    const columns = await this.columns();

    return columns.exists ? this.withConstraint(columns) : columns;
  }

  private async columns(): Promise<ReadModelTableState> {
    const { schema, table, data, deleted = 'deleted' } = this.target();
    const held = new Map((await this.run(COLUMNS, [pathOf(schema, table)])).map((row) => [row['column'], row]));
    const kinds = data.map((column) => ({ column, because: kindOf(held.get(column)) }));
    const unfit = kinds.flatMap(({ column, because }) => (because === undefined ? [] : [{ column, because }]));
    const row = data.filter((column) => !unfit.some((left) => left.column === column));

    return {
      table,
      exists: held.size > 0,
      refusing: held.size === 0 ? [] : row.filter((column) => held.get(column)?.['refusing'] === true),
      unfit: held.size === 0 ? [] : unfit,
      row,
      deleted,
      ...(schema === undefined ? {} : { schema }),
    };
  }

  private async withConstraint(columns: ReadModelTableState): Promise<ReadModelTableState> {
    const { schema, table, deleted } = columns;
    const [held] = await this.run(CONSTRAINT, [pathOf(schema, table), liveRowsConstraintOf(table)]);

    if (held === undefined) {
      return { ...columns, constraint: { state: 'missing', columns: [] } };
    }

    const definition = String(held['definition']);
    const whole = wholeColumnsOf(definition, deleted);

    if (whole === undefined) {
      return { ...columns, constraint: { state: 'unexpected', columns: [], definition } };
    }

    return { ...columns, constraint: { state: held['valid'] === true ? 'held' : 'not-valid', columns: whole } };
  }
}

type Unfit = ReadModelTableState['unfit'][number]['because'];

/** Why a trace can never hold NULL in the column, when it cannot. */
function kindOf(column: Readonly<Record<string, unknown>> | undefined): Unfit | undefined {
  if (column === undefined) {
    return 'absent';
  }

  if (column['key'] === true) {
    return 'primary-key';
  }

  if (column['identity'] === true) {
    return 'identity';
  }

  return column['generated'] === true ? 'generated' : undefined;
}

/**
 * The columns a constraint keeps whole, read from its definition as PostgreSQL writes it,
 * `CHECK ((deleted OR ((a IS NOT NULL) AND (b IS NOT NULL))))`; `undefined` for any other check.
 */
function wholeColumnsOf(definition: string, deleted: string): string[] | undefined {
  const flat = definition
    .replace(/ NOT VALID$/, '')
    .replace(/^CHECK /, '')
    .replaceAll(/[()]/g, '');

  const [marked, live, ...more] = flat.split(' OR ');
  const columns = (live ?? '').split(' AND ').map((part) => / IS NOT NULL$/.test(part) && part.slice(0, -12));

  if (more.length > 0 || unquoted(marked ?? '') !== deleted || columns.includes(false)) {
    return undefined;
  }

  return columns.flatMap((column) => (column === false ? [] : [unquoted(column)]));
}

function unquoted(identifier: string): string {
  return /^".*"$/.test(identifier) ? identifier.slice(1, -1).replaceAll('""', '"') : identifier;
}

function pathOf(schema: string | undefined, table: string): string {
  return schema === undefined ? quoted(table) : `${quoted(schema)}.${quoted(table)}`;
}

function quoted(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

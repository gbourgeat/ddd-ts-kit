import { liveRowsColumnsOf } from './live-rows-columns-of';
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

/** Every column of the table, as a statement resolves it: what a trace needs to know of each, and what kind of relation holds them. */
const COLUMNS = `select col.attname as "column", col.attnotnull as "refusing", col.attidentity <> '' as "identity", col.attgenerated <> '' as "generated", exists (select 1 from pg_index as pk where pk.indrelid = col.attrelid and pk.indisprimary and col.attnum = any (pk.indkey)) as "key", exists (select 1 from pg_type as typ where typ.oid = col.atttypid and typ.typtype = 'd' and typ.typnotnull) as "domain", (select rel.relkind::text from pg_class as rel where rel.oid = col.attrelid) as "relation" from pg_attribute as col where col.attrelid = to_regclass($1) and col.attnum > 0 and not col.attisdropped`;

/** Every check constraint of the table, as PostgreSQL writes it, with the columns it names. */
const CHECKS = `select con.conname as "name", con.convalidated as "valid", pg_get_constraintdef(con.oid) as "definition", array_to_json(array(select att.attname from pg_attribute as att where att.attrelid = con.conrelid and att.attnum = any (con.conkey)))::text as "columns" from pg_constraint as con where con.conrelid = to_regclass($1) and con.contype = 'c' order by con.conname`;

const RELATIONS: Readonly<Record<string, NonNullable<ReadModelTableState['relation']>>> = {
  v: 'view',
  m: 'materialized-view',
  f: 'foreign-table',
};

type Row = Readonly<Record<string, unknown>>;

/**
 * Whether the table of a read model on PostgreSQL can hold the trace of a deleted row, read from
 * the database for the columns the store maps and for no other: each accepts NULL, and none is a
 * part of the primary key, an identity or a generated column, nor of a domain that refuses NULL,
 * which nothing can open. The table is read as a statement would resolve it (the search path
 * when no schema is named). `require` is the refusal of a store before its first trace, by name
 * and not by a statement that would abort the transaction of the event; it reads once, and the
 * check constraints only for a table it refuses. `state` is the same reading with the
 * constraints, for the tables an application lists and checks when it starts
 * (`ReadModelTables`): one code, so one verdict. The copy of a rebuild is made like the table.
 * Shared by the ORM adapters, which differ only in how they run a statement.
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
      throw new ReadModelTableNotReadyError(columns.exists ? await this.withChecks(columns) : columns);
    }

    this.ready = true;
  }

  /** What the table can hold, what its check constraint keeps whole and what else checks its row. */
  async state(): Promise<ReadModelTableState> {
    const columns = await this.columns();

    return columns.exists ? this.withChecks(columns) : columns;
  }

  private async columns(): Promise<ReadModelTableState> {
    const { schema, table, data, deleted = 'deleted' } = this.target();
    const read = await this.run(COLUMNS, [pathOf(schema, table)]);
    const held = new Map(read.map((row) => [row['column'], row]));
    const kinds = data.map((column) => ({ column, because: kindOf(held.get(column)) }));
    const unfit = kinds.flatMap(({ column, because }) => (because === undefined ? [] : [{ column, because }]));
    const row = data.filter((column) => !unfit.some((left) => left.column === column));
    const relation = RELATIONS[String(read[0]?.['relation'])];

    return {
      table,
      exists: held.size > 0,
      refusing: held.size === 0 ? [] : row.filter((column) => held.get(column)?.['refusing'] === true),
      unfit: held.size === 0 ? [] : unfit,
      row,
      deleted,
      ...(schema === undefined ? {} : { schema }),
      ...(relation === undefined ? {} : { relation }),
    };
  }

  private async withChecks(columns: ReadModelTableState): Promise<ReadModelTableState> {
    const { schema, table } = columns;
    const name = liveRowsConstraintOf(table);
    const checks = await this.run(CHECKS, [pathOf(schema, table)]);
    const others = checks.filter((check) => check['name'] !== name).flatMap((check) => namingTheRow(check, columns));

    return {
      ...columns,
      constraint: constraintOf(
        checks.find((check) => check['name'] === name),
        columns.deleted,
      ),
      ...(others.length === 0 ? {} : { checks: others }),
    };
  }
}

/** The constraint of the live rows as the table holds it: the kit's form and what it keeps whole, or another check under its name. */
function constraintOf(held: Row | undefined, deleted: string): NonNullable<ReadModelTableState['constraint']> {
  if (held === undefined) {
    return { state: 'missing', columns: [] };
  }

  const definition = String(held['definition']);
  const whole = liveRowsColumnsOf(definition, deleted);

  if (whole === undefined) {
    return { state: 'unexpected', columns: [], definition };
  }

  return { state: held['valid'] === true ? 'held' : 'not-valid', columns: whole };
}

/**
 * Another check constraint, when it names a column of the row: it may refuse the NULL of a trace
 * there. One that holds for the live rows only, written `deleted or ..` as PostgreSQL prints it,
 * lets every trace in and is not named.
 */
function namingTheRow(check: Row, { row, deleted }: ReadModelTableState): NonNullable<ReadModelTableState['checks']> {
  const named: unknown = JSON.parse(String(check['columns']));
  const definition = String(check['definition']);
  const live = [deleted, quoted(deleted)].some((mark) => definition.startsWith(`CHECK ((${mark} OR `));

  return !live && Array.isArray(named) && named.some((column) => row.includes(String(column)))
    ? [{ name: String(check['name']), definition }]
    : [];
}

type Unfit = ReadModelTableState['unfit'][number]['because'];

const KINDS: readonly (readonly [flag: string, because: Unfit])[] = [
  ['key', 'primary-key'],
  ['identity', 'identity'],
  ['generated', 'generated'],
  ['domain', 'domain'],
];

/** Why a trace can never hold NULL in the column, when it cannot. */
function kindOf(column: Row | undefined): Unfit | undefined {
  if (column === undefined) {
    return 'absent';
  }

  return KINDS.find(([flag]) => column[flag] === true)?.[1];
}

function pathOf(schema: string | undefined, table: string): string {
  return schema === undefined ? quoted(table) : `${quoted(schema)}.${quoted(table)}`;
}

function quoted(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

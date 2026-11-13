import { LIVE_ROWS_CONSTRAINT_FORM } from './live-rows-constraint-form';
import { liveRowsConstraintOf } from './live-rows-constraint-of';
import type { ReadModelTableState } from '../../application/read-model/read-model-table-state';

/** The migration of a read model table, in the two steps a large table runs apart. */
interface ReadModelTableMigration {
  /**
   * The change of definition: NOT NULL dropped and the check constraint written, `not valid`, in
   * one statement. Brief, under the lock that stops the readers and the writers of the table.
   */
  readonly definition: readonly string[];
  /**
   * The validation of the constraint and the cleaning of the rows deleted before: both read the
   * whole table under a lock that lets readers and writers through, when they run outside the
   * transaction of the first step.
   */
  readonly validation: readonly string[];
}

/**
 * The migration that makes a read model table ready, PostgreSQL statements written from the
 * columns the store maps and from nothing else. NOT NULL is dropped on the columns of the row
 * that refuse it and, in the same statement, the check constraint that keeps the live rows whole
 * is written again when it is missing or does not hold those columns, `not valid`: no row can be
 * written between the two, whatever commits each statement. A constraint of that name that is
 * not written as the kit writes it is never dropped: the statement reads its definition first and
 * fails on it, on the database it runs against. Then the constraint is validated and the rows
 * deleted before are emptied, those that still hold data alone. Run twice, it ends where it ended
 * the first time and fails on nothing. It never names the key, the tenant, the stamp, a column
 * the store does not map, nor one that is unfit. Nothing is written while the definition alone
 * was read.
 */
export function readModelTableMigration(state: ReadModelTableState): ReadModelTableMigration {
  const { refusing, row, constraint } = state;

  if (constraint === undefined || refusing.length === 0) {
    return { definition: [], validation: constraint?.state === 'not-valid' ? [validated(state)] : [] };
  }

  const whole = [...new Set([...constraint.columns, ...refusing])];
  const held = row.map((column) => `${quoted(column)} is not null`).join(' or ');
  const emptied = row.map((column) => `${quoted(column)} = null`).join(', ');
  const cleaned = `update ${pathOf(state)} set ${emptied} where ${quoted(state.deleted)} and (${held});`;

  if (constraint.state === 'unexpected') {
    return { definition: [`alter table ${pathOf(state)} ${opened(state)};`], validation: [cleaned] };
  }

  if (constraint.state !== 'missing' && whole.length === constraint.columns.length) {
    return {
      definition: [`alter table ${pathOf(state)} ${opened(state)};`],
      validation: [...(constraint.state === 'not-valid' ? [validated(state)] : []), cleaned],
    };
  }

  return { definition: [rewritten(state, whole)], validation: [validated(state), cleaned] };
}

function opened({ refusing }: ReadModelTableState): string {
  return refusing.map((column) => `alter column ${quoted(column)} drop not null`).join(', ');
}

/**
 * NOT NULL dropped and the constraint written again in one statement, once the constraint the
 * database holds under that name, if any, is known to be the kit's.
 */
function rewritten(state: ReadModelTableState, whole: readonly string[]): string {
  const path = pathOf(state);
  const name = liveRowsConstraintOf(state.table);
  const checked = whole.map((column) => `${quoted(column)} is not null`).join(' and ');

  const table = state.schema === undefined ? state.table : `${state.schema}.${state.table}`;
  const refused = `The constraint ${name} of ${table} is not written as ddd-ts-kit writes the one that keeps the live rows of a read model whole: it is left as it is, and nothing was changed.`;

  const body = [
    'begin',
    `  if exists (select 1 from pg_constraint where conrelid = to_regclass(${literal(path)}) and conname = ${literal(name)} and pg_get_constraintdef(oid) !~ ${literal(LIVE_ROWS_CONSTRAINT_FORM)}) then`,
    `    raise exception ${literal(refused.replaceAll('%', '%%'))};`,
    '  end if;',
    `  alter table ${path} ${opened(state)}, drop constraint if exists ${quoted(name)}, add constraint ${quoted(name)} check (${quoted(state.deleted)} or (${checked})) not valid;`,
    'end',
  ].join('\n');

  const tag = dollarTagFor(body);

  return `do ${tag}\n${body}\n${tag};`;
}

/** A dollar quote no name of the statement can close: `$kit$`, lengthened while the body holds it. */
function dollarTagFor(body: string): string {
  let tag = 'kit';

  while (body.includes(`$${tag}$`)) {
    tag += '_';
  }

  return `$${tag}$`;
}

function validated(state: ReadModelTableState): string {
  return `alter table ${pathOf(state)} validate constraint ${quoted(liveRowsConstraintOf(state.table))};`;
}

/** The table as a statement names it: its schema first when it has one. */
function pathOf({ schema, table }: ReadModelTableState): string {
  return schema === undefined ? quoted(table) : `${quoted(schema)}.${quoted(table)}`;
}

/** Every identifier is quoted: a reserved word, a capital or a hyphen is then written as the database holds it. */
function quoted(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function literal(text: string): string {
  return `'${text.replaceAll("'", "''")}'`;
}

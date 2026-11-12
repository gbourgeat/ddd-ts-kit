import { liveRowsConstraintOf } from './live-rows-constraint-of';
import type { ReadModelTableState } from '../../application/read-model/read-model-table-state';

/**
 * The migration that makes a read model table ready, one PostgreSQL statement per entry, written
 * from the columns the store maps and from nothing else: NOT NULL dropped on the columns of the
 * row that refuse it; the check constraint that keeps the live rows whole written again when it
 * is missing or does not hold those columns, added `not valid` and validated apart, so that the
 * scan of the table does not hold the lock that stops its readers; and the rows deleted before
 * emptied, those that still hold data alone. Run twice, it ends where it ended the first time and
 * fails on nothing. It never names the key, the tenant, the stamp, a column the store does not
 * map, nor one that is unfit, and it leaves alone a constraint that checks something else.
 * Nothing is written while the definition alone was read.
 */
export function readModelTableMigration(state: ReadModelTableState): string[] {
  const { refusing, row, constraint } = state;

  if (constraint === undefined || refusing.length === 0) {
    return constraint?.state === 'not-valid' ? [validated(state)] : [];
  }

  const path = pathOf(state);
  const opened = refusing.map((column) => `alter column ${quoted(column)} drop not null`).join(', ');
  const marked = quoted(state.deleted);
  const held = row.map((column) => `${quoted(column)} is not null`).join(' or ');
  const emptied = row.map((column) => `${quoted(column)} = null`).join(', ');

  return [
    `alter table ${path} ${opened};`,
    ...constraintStatements(state),
    `update ${path} set ${emptied} where ${marked} and (${held});`,
  ];
}

/** The constraint with the columns it held and those that just lost NOT NULL, unless it holds them already or checks something else. */
function constraintStatements(state: ReadModelTableState): string[] {
  const { refusing, constraint = { state: 'missing', columns: [] } } = state;
  const whole = [...new Set([...constraint.columns, ...refusing])];

  if (constraint.state === 'unexpected') {
    return [];
  }

  if (constraint.state !== 'missing' && whole.length === constraint.columns.length) {
    return constraint.state === 'not-valid' ? [validated(state)] : [];
  }

  const path = pathOf(state);
  const name = quoted(liveRowsConstraintOf(state.table));
  const checked = whole.map((column) => `${quoted(column)} is not null`).join(' and ');

  return [
    `alter table ${path} drop constraint if exists ${name};`,
    `alter table ${path} add constraint ${name} check (${quoted(state.deleted)} or (${checked})) not valid;`,
    validated(state),
  ];
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

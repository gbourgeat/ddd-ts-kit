import { liveRowsConstraintOf, type UnreadyReadModelTable } from './unready-read-model-table';

/**
 * The migration that makes a read model table ready, as PostgreSQL statements: NOT NULL dropped on
 * the columns that refuse it, the check constraint that keeps the live rows whole in its place, and
 * the rows deleted before emptied. A constraint the table already holds is not written again: its
 * check is to take the columns up, which a comment says.
 */
export function readModelTableMigration(unready: UnreadyReadModelTable): string {
  const { table, refusing, row, constraint } = unready;
  const path = readModelTablePath(unready);
  const name = liveRowsConstraintOf(table);
  const whole = refusing.map((column) => `${quoted(column)} is not null`).join(' and ');
  const dropped = refusing.map((column) => `alter column ${quoted(column)} drop not null`);
  const added = constraint === true ? [] : [`add constraint ${named(name)} check (deleted or (${whole}))`];
  const emptied = row.map((column) => `${quoted(column)} = null`).join(', ');

  return [
    `alter table ${path}\n  ${[...dropped, ...added].join(',\n  ')};`,
    ...(constraint === true ? [`-- ${name} is there already: write it again so that it holds (${whole}) too.`] : []),
    `update ${path} set ${emptied} where deleted;`,
  ].join('\n');
}

/** The table as a statement names it: its schema first when it has one, quoted where PostgreSQL asks for it. */
export function readModelTablePath({ schema, table }: Pick<UnreadyReadModelTable, 'schema' | 'table'>): string {
  return schema === undefined ? named(table) : `${named(schema)}.${named(table)}`;
}

/** An identifier as it is written: bare when PostgreSQL reads it as it stands, quoted otherwise. */
function named(identifier: string): string {
  return /^[a-z_][a-z0-9_]*$/.test(identifier) ? identifier : quoted(identifier);
}

function quoted(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

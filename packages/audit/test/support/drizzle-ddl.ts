import { SQL, is } from 'drizzle-orm';
import { PgDialect, getTableConfig, type PgTable } from 'drizzle-orm/pg-core';

const dialect = new PgDialect();
const quote = (name: string): string => `"${name}"`;

/**
 * The DDL of a table, derived from its drizzle definition the way drizzle-kit would, so the
 * specs run against the columns, keys and indexes the package really declares (drizzle-kit
 * itself is not a dependency of this repository).
 */
export function createTableSql(table: PgTable): string[] {
  const config = getTableConfig(table);
  const name = [config.schema, config.name].filter((part) => part !== undefined).map(quote).join('.');

  const columns = config.columns.map((column) =>
    [
      `${quote(column.name)} ${column.getSQLType()}`,
      column.notNull ? ' not null' : '',
      defaultOf(column.default),
      column.primary ? ' primary key' : '',
      column.isUnique ? ' unique' : '',
    ].join(''),
  );

  const primaryKeys = config.primaryKeys.map((key) => `primary key (${key.columns.map((column) => quote(column.name)).join(', ')})`);

  const indexes = config.indexes.map(({ config: index }) => {
    const on = index.columns.map((column) => ('name' in column && column.name !== undefined ? quote(column.name) : ''));

    return `create index ${quote(index.name ?? '')} on ${name} (${on.join(', ')})`;
  });

  return [
    ...(config.schema === undefined ? [] : [`create schema if not exists ${quote(config.schema)}`]),
    `create table ${name} (${[...columns, ...primaryKeys].join(', ')})`,
    ...indexes,
  ];
}

function defaultOf(value: unknown): string {
  if (value === undefined) return '';

  if (is(value, SQL)) return ` default ${dialect.sqlToQuery(value.inlineParams()).sql}`;

  return ` default '${typeof value === 'string' ? value : JSON.stringify(value)}'`;
}

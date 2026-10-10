import { SQL, is } from 'drizzle-orm';
import { PgDialect, getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { quote } from './quote.js';

const dialect = new PgDialect();
const render = (fragment: SQL): string => dialect.sqlToQuery(fragment.inlineParams()).sql;

/**
 * The DDL of a table, derived from its drizzle definition the way drizzle-kit would, so the
 * tests run against the columns and indexes the package really declares (drizzle-kit itself
 * is not a dependency of this repository).
 */
export function createTableSql(table: PgTable): string[] {
  const config = getTableConfig(table);

  const tableName = [config.schema, config.name]
    .filter((part) => part !== undefined)
    .map(quote)
    .join('.');

  const columns = config.columns.map((column) => {
    const value: unknown = column.default;

    const fallback = !column.hasDefault || value === undefined
      ? ''
      : ` default ${is(value, SQL) ? render(value) : typeof value === 'string' ? `'${value}'` : String(value)}`;

    return [
      `${quote(column.name)} ${column.getSQLType()}`,
      column.generatedIdentity === undefined ? '' : ` generated ${column.generatedIdentity.type === 'always' ? 'always' : 'by default'} as identity`,
      column.notNull ? ' not null' : '',
      fallback,
      column.primary ? ' primary key' : '',
    ].join('');
  });

  const primaryKeys = config.primaryKeys.map(
    (key) => `primary key (${key.columns.map((column) => quote(column.name)).join(', ')})`,
  );

  const indexes = config.indexes.map(({ config: index }) => {
    const on = index.columns.map((column) => {
      if ('name' in column && column.name !== undefined) {
        return quote(column.name);
      }

      throw new Error('Expression indexes are not supported by this test helper');
    });

    const where = index.where === undefined ? '' : ` where ${render(index.where)}`;

    return `create ${index.unique ? 'unique ' : ''}index ${quote(index.name ?? '')} on ${tableName} (${on.join(', ')})${where}`;
  });

  return [
    ...(config.schema === undefined ? [] : [`create schema if not exists ${quote(config.schema)}`]),
    `create table ${tableName} (${[...columns, ...primaryKeys].join(', ')})`,
    ...indexes,
  ];
}

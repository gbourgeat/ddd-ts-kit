import { PGlite } from '@electric-sql/pglite';
import { SQL, is, type Logger } from 'drizzle-orm';
import { PgDialect, getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';

/** A drizzle logger that keeps the SQL it was given, to assert what was really sent. */
export class RecordingLogger implements Logger {
  readonly queries: string[] = [];

  logQuery(query: string): void {
    this.queries.push(query);
  }
}

const dialect = new PgDialect();
const quote = (name: string): string => `"${name}"`;
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

/** One in-process PostgreSQL (PGlite) with the given tables created. */
export async function createDatabase(tables: readonly PgTable[]) {
  const client = new PGlite();
  const logger = new RecordingLogger();
  for (const statement of tables.flatMap(createTableSql)) {
    await client.exec(statement);
  }
  const db = drizzle(client, { logger });
  const truncate = async (): Promise<void> => {
    for (const table of tables) {
      const { schema, name } = getTableConfig(table);
      const target = [schema, name].filter((part) => part !== undefined).map(quote).join('.');
      await client.exec(`truncate table ${target} restart identity`);
    }
    logger.queries.length = 0;
  };
  return { client, db, logger, truncate };
}

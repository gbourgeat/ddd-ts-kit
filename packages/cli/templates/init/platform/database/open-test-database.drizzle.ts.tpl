import { PGlite } from '@electric-sql/pglite';
import { is, sql, SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect, PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';
import { connectToDatabase } from '{{alias.platform}}/database/connect-to-database.js';
import { persistenceOver } from '{{alias.platform}}/database/persistence-over.js';
import type { Persistence } from '{{alias.platform}}/database/persistence.js';
{{#if audit.on}}
import { auditGuardStatements } from '@ddd-ts-kit/audit/drizzle';
{{/if}}
import * as schema from '{{alias.platform}}/database/schema.js';

export interface TestDatabase {
  readonly persistence: Persistence;

  /** Empties every table{{#if audit.on}} but the audit trail, which is append-only whoever asks{{/if}}: call it before each test. */
  reset(): Promise<void>;

  close(): Promise<void>;
}

/**
 * PostgreSQL in process (PGlite) by default, with the tables of ./schema.ts created from their
 * Drizzle definitions: adapter and end-to-end specs need no container and no migration run.
 * With a URL, the tests run on that server instead, which must already be migrated
 * (`npm run db:migrate`); the migrations remain what production applies.
 */
export function openTestDatabase(url?: string): Promise<TestDatabase> {
  return url === undefined ? openInProcess() : openServer(url);
}

async function openInProcess(): Promise<TestDatabase> {
  const client = new PGlite();

{{#if audit.on}}
  for (const statement of [...tables().flatMap(createStatements), ...auditGuardStatements(schema.AUDIT_SCHEMA)]) {
    await client.exec(statement);
  }
{{/if}}
{{#unless audit.on}}
  for (const statement of tables().flatMap(createStatements)) {
    await client.exec(statement);
  }
{{/unless}}

  return {
    persistence: persistenceOver(drizzle(client), () => client.close()),
    reset: async () => {
      await client.exec(truncateStatement());
    },
    close: () => client.close(),
  };
}

async function openServer(url: string): Promise<TestDatabase> {
  const connection = connectToDatabase(url);

  return {
    persistence: persistenceOver(connection.db, () => connection.close()),
    reset: async () => {
      await connection.db.execute(sql.raw(truncateStatement()));
    },
    close: () => connection.close(),
  };
}

function tables(): PgTable[] {
  const exported: readonly unknown[] = Object.values(schema);

  return exported.filter((value): value is PgTable => is(value, PgTable));
}

{{#if audit.on}}
function truncateStatement(): string {
  const emptied = tables().filter((table) => getTableConfig(table).schema !== schema.AUDIT_SCHEMA);

  return 'truncate table ' + emptied.map(qualifiedName).join(', ') + ' restart identity';
}
{{/if}}
{{#unless audit.on}}
function truncateStatement(): string {
  return 'truncate table ' + tables().map(qualifiedName).join(', ') + ' restart identity';
}
{{/unless}}

function qualifiedName(table: PgTable): string {
  const { schema: owner, name } = getTableConfig(table);

  return owner === undefined ? quote(name) : quote(owner) + '.' + quote(name);
}

function createStatements(table: PgTable): string[] {
  const { schema: owner, columns, primaryKeys } = getTableConfig(table);

  const keys = primaryKeys.map(
    (key) => 'primary key (' + key.columns.map((column) => quote(column.name)).join(', ') + ')',
  );

  const body = [...columns.map(columnDefinition), ...keys].join(', ');

  return [
    ...(owner === undefined ? [] : ['create schema if not exists ' + quote(owner)]),
    'create table if not exists ' + qualifiedName(table) + ' (' + body + ')',
  ];
}

type Column = ReturnType<typeof getTableConfig>['columns'][number];

function columnDefinition(column: Column): string {
  const identity = column.generatedIdentity === undefined ? '' : ' generated always as identity';

  return [
    quote(column.name) + ' ' + column.getSQLType() + identity,
    column.notNull ? ' not null' : '',
    defaultClause(column),
    column.primary ? ' primary key' : '',
  ].join('');
}

const dialect = new PgDialect();

function defaultClause(column: Column): string {
  const value: unknown = column.default;

  if (!column.hasDefault || value === undefined) {
    return '';
  }

  if (is(value, SQL)) {
    return ' default ' + dialect.sqlToQuery(value.inlineParams()).sql;
  }

  // A text or a JSON document is a quoted literal; a number or a boolean is written as it is.
  return (
    ' default ' +
    (typeof value === 'string'
      ? "'" + value + "'"
      : typeof value === 'object'
        ? "'" + JSON.stringify(value) + "'"
        : JSON.stringify(value))
  );
}

function quote(name: string): string {
  return '"' + name + '"';
}

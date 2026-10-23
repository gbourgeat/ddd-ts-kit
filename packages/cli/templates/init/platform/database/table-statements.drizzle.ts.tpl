{{#if audit.on}}
import { auditGuardStatements } from '@ddd-ts-kit/audit/drizzle';
{{/if}}
import { is, SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '{{alias.platform}}/database/schema{{alias.ext}}';

type Column = ReturnType<typeof getTableConfig>['columns'][number];

const dialect = new PgDialect();

/**
 * The SQL the in-process database of the tests runs: the tables of ./schema.ts, created from
 * their Drizzle definitions{{#if audit.on}} with the triggers that keep the audit trail append-only{{/if}}, and how
 * to empty them. The migrations remain what production applies.
 */
export class TableStatements {
  private readonly tables: readonly PgTable[];

  constructor() {
    const exported: readonly unknown[] = Object.values(schema);

    this.tables = exported.filter((value): value is PgTable => is(value, PgTable));
  }

  /** One `create schema` per schema and one `create table` per table, in the order of ./schema.ts. */
  creating(): readonly string[] {
{{#if audit.on}}
    return [...this.tables.flatMap(createStatements), ...auditGuardStatements(schema.AUDIT_SCHEMA)];
{{/if}}
{{#unless audit.on}}
    return this.tables.flatMap(createStatements);
{{/unless}}
  }

  /** Every table{{#if audit.on}} but the audit trail, which is append-only whoever asks{{/if}}, emptied in one statement. */
  emptying(): string {
{{#if audit.on}}
    const emptied = this.tables.filter((table) => getTableConfig(table).schema !== schema.AUDIT_SCHEMA);

    return 'truncate table ' + emptied.map(qualifiedName).join(', ') + ' restart identity';
{{/if}}
{{#unless audit.on}}
    return 'truncate table ' + this.tables.map(qualifiedName).join(', ') + ' restart identity';
{{/unless}}
  }
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

function columnDefinition(column: Column): string {
  const identity = column.generatedIdentity === undefined ? '' : ' generated always as identity';

  return [
    quote(column.name) + ' ' + column.getSQLType() + identity,
    column.notNull ? ' not null' : '',
    defaultClause(column),
    column.primary ? ' primary key' : '',
  ].join('');
}

function defaultClause(column: Column): string {
  const value: unknown = column.default;

  return !column.hasDefault || value === undefined ? '' : ' default ' + literalOf(value);
}

/** An expression as it was given; a text or a JSON document as a quoted literal; a number or a boolean as it is. */
function literalOf(value: unknown): string {
  if (is(value, SQL)) {
    return dialect.sqlToQuery(value.inlineParams()).sql;
  }

  if (typeof value === 'string') {
    return "'" + value + "'";
  }

  return typeof value === 'object' ? "'" + JSON.stringify(value) + "'" : JSON.stringify(value);
}

function qualifiedName(table: PgTable): string {
  const { schema: owner, name } = getTableConfig(table);

  return owner === undefined ? quote(name) : quote(owner) + '.' + quote(name);
}

function quote(name: string): string {
  return '"' + name + '"';
}

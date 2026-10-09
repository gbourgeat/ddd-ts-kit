import { sql, type SQL, type TablesRelationalConfig } from 'drizzle-orm';
import { bigint, index, jsonb, pgSchema, pgTable, primaryKey, text, timestamp, type PgDatabase, type PgQueryResultHKT, type PgTableFn } from 'drizzle-orm/pg-core';
import type { AuditChanges } from './entry.js';
import { PostgresAuditTrail } from './sql/postgres-audit-trail.js';
import { rowsOf, type Sql, type SqlSession } from './sql/statement.js';
import { AUDIT_CHAINS_TABLE, AUDIT_ENTRIES_TABLE, auditGuardSql, auditTables } from './sql/tables.js';
import type { AuditTrailOptions } from './trail.js';

/** The `DrizzleContext` of `@ddd-ts-kit/drizzle`, restated structurally: any unit of work of that package fits. */
export interface DrizzleAuditContext<Q extends PgQueryResultHKT, F extends Record<string, unknown>, S extends TablesRelationalConfig> {
  executor(): PgDatabase<Q, F, S>;
}

export interface DrizzleAuditTrailOptions extends AuditTrailOptions {
  /** The schema the tables were declared in with `auditEntriesTable(schemaName)`. Default `public`. */
  readonly schema?: string;
}

/**
 * The audit trail on PostgreSQL through drizzle, for any driver. It writes on the executor of
 * the context: inside a unit of work the entry commits or rolls back with it.
 */
export class DrizzleAuditTrail<
  Q extends PgQueryResultHKT,
  F extends Record<string, unknown>,
  S extends TablesRelationalConfig,
> extends PostgresAuditTrail {
  constructor(context: DrizzleAuditContext<Q, F, S>, options: DrizzleAuditTrailOptions = {}) {
    super(() => sessionOn(context.executor()), auditTables(options), options);
  }
}

function sessionOn<Q extends PgQueryResultHKT, F extends Record<string, unknown>, S extends TablesRelationalConfig>(
  database: PgDatabase<Q, F, S>,
): SqlSession {
  return {
    query: async (statement) => {
      const result: unknown = await database.execute(drizzleSqlOf(statement));
      return rowsOf(result);
    },
    transaction: (work) => database.transaction((transaction) => work(sessionOn(transaction))),
  };
}

function drizzleSqlOf(statement: Sql): SQL {
  const [first = '', ...rest] = statement.strings;
  const following = rest.flatMap((literal, index) => [sql.param(statement.values[index]), sql.raw(literal)]);
  return sql.join([sql.raw(first), ...following]);
}

/**
 * The entries table, to include in the schema files drizzle-kit reads so that the migrations
 * of the consuming project create it. Without a schema name it lives in `public`. Add
 * `auditChainsTable` next to it and `auditGuardStatements` in a custom migration.
 */
export function auditEntriesTable(schemaName?: string) {
  return tableIn(schemaName)(AUDIT_ENTRIES_TABLE, ENTRY_COLUMNS, (table) => [
    primaryKey({ columns: [table.chain, table.sequence] }),
    index('audit_entries_occurred_idx').on(table.occurredAt, table.chain, table.sequence),
    index('audit_entries_actor_idx').on(table.actorId, table.occurredAt),
    index('audit_entries_resource_idx').on(table.resourceType, table.resourceId),
    index('audit_entries_correlation_idx').on(table.correlationId),
  ]);
}

export type AuditEntriesTable = ReturnType<typeof auditEntriesTable>;

function tableIn(schemaName: string | undefined): PgTableFn<string | undefined> {
  return schemaName === undefined ? pgTable : pgSchema(schemaName).table;
}

const ENTRY_COLUMNS = {
  id: text('id').notNull().unique(),
  chain: text('chain').notNull(),
  sequence: bigint('sequence', { mode: 'number' }).notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date', precision: 3 }).notNull(),
  category: text('category').notNull(),
  action: text('action').notNull(),
  outcome: text('outcome').notNull(),
  reason: text('reason'),
  actorId: text('actor_id').notNull(),
  actorType: text('actor_type').notNull(),
  actorTenantId: text('actor_tenant_id'),
  tenantId: text('tenant_id'),
  impersonatedBy: text('impersonated_by'),
  sessionId: text('session_id'),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  context: text('context'),
  correlationId: text('correlation_id').notNull(),
  causationId: text('causation_id'),
  origin: text('origin').notNull(),
  changes: jsonb('changes').$type<AuditChanges>(),
  extensions: jsonb('extensions').notNull().default({}),
  previousHash: text('previous_hash').notNull(),
  hash: text('hash').notNull(),
};

/** The head of each chain: the row an append locks. One row per chain, updated in place. */
export function auditChainsTable(schemaName?: string) {
  return tableIn(schemaName)(AUDIT_CHAINS_TABLE, {
    chain: text('chain').primaryKey(),
    sequence: bigint('sequence', { mode: 'number' }).notNull(),
    hash: text('hash').notNull(),
  });
}

export type AuditChainsTable = ReturnType<typeof auditChainsTable>;

/**
 * drizzle-kit does not generate triggers: paste these statements in a custom migration
 * (`drizzle-kit generate --custom`) after the one that creates the tables. They make
 * `audit_entries` refuse UPDATE, DELETE and TRUNCATE.
 */
export function auditGuardStatements(schemaName?: string): string[] {
  return auditGuardSql(schemaName === undefined ? {} : { schema: schemaName });
}

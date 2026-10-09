import type { Knex } from 'knex';
import { PostgresAuditTrail } from './sql/postgres-audit-trail.js';
import { rowsOf, type Sql, type SqlSession } from './sql/statement.js';
import { auditTables, auditTablesSql, dropAuditTablesSql, type AuditTablesOptions } from './sql/tables.js';
import type { AuditTrailOptions } from './trail.js';

export type { AuditTablesOptions } from './sql/tables.js';

/** The `KnexContext` of `@ddd-ts-kit/knex`, restated structurally: any unit of work of that package fits. */
export interface KnexAuditContext {
  executor(): Knex;
}

export interface KnexAuditTrailOptions extends AuditTrailOptions, AuditTablesOptions {}

/**
 * The audit trail on PostgreSQL through knex. It writes on the executor of the context: inside
 * a unit of work the entry commits or rolls back with it, outside it is written at once.
 */
export class KnexAuditTrail extends PostgresAuditTrail {
  constructor(context: KnexAuditContext, options: KnexAuditTrailOptions = {}) {
    super(() => sessionOn(context.executor()), auditTables(options), options);
  }
}

function sessionOn(knex: Knex): SqlSession {
  return {
    query: async (statement) => rowsOf(await knex.raw(statement.strings.join('?'), bindingsOf(statement))),
    transaction: (work) => knex.transaction((transaction) => work(sessionOn(transaction))),
  };
}

function bindingsOf(statement: Sql): Knex.RawBinding[] {
  return statement.values.map((value) => (typeof value === 'number' || typeof value === 'string' ? value : null));
}

/**
 * Creates the tables of the trail and the triggers that keep `audit_entries` append-only.
 * Call it from a migration of the consuming project, which then owns the tables:
 * `export const up = (knex) => createAuditTables(knex, { schema: 'audit' })`.
 */
export async function createAuditTables(knex: Knex, options: AuditTablesOptions = {}): Promise<void> {
  for (const statement of auditTablesSql(options)) await knex.raw(statement);
}

/** The `down` of `createAuditTables`: the trail is gone with it. The schema is left in place. */
export async function dropAuditTables(knex: Knex, options: AuditTablesOptions = {}): Promise<void> {
  for (const statement of dropAuditTablesSql(options)) await knex.raw(statement);
}

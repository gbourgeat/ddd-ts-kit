import type { Knex } from 'knex';
import { auditTables } from '../sql/audit-tables.js';
import type { AuditTablesOptions } from '../sql/audit-tables-options.js';
import { PostgresAuditTrail } from '../sql/postgres-audit-trail.js';
import { rowsOf } from '../sql/rows-of.js';
import type { SqlSession } from '../sql/sql-session.js';
import type { Sql } from '../sql/statement.js';
import type { AuditTrailOptions } from '../trail/audit-trail-options.js';
import type { KnexAuditContext } from './knex-audit-context.js';

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

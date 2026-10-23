import type { Knex } from 'knex';
import { auditTables } from '../sql/audit-tables';
import type { AuditTablesOptions } from '../sql/audit-tables-options';
import { PostgresAuditTrail } from '../sql/postgres-audit-trail';
import { rowsOf } from '../sql/rows-of';
import type { SqlSession } from '../sql/sql-session';
import type { Sql } from '../sql/sql';
import type { AuditTrailOptions } from '../trail/audit-trail-options';
import type { KnexAuditContext } from './knex-audit-context';

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
    ambientTransaction: knex.isTransaction === true ? knex : undefined,
    query: async (statement) => rowsOf(await knex.raw(statement.strings.join('?'), bindingsOf(statement))),
    transaction: (work) => knex.transaction((transaction) => work(sessionOn(transaction))),
  };
}

function bindingsOf(statement: Sql): Knex.RawBinding[] {
  return statement.values.map((value) => (typeof value === 'number' || typeof value === 'string' ? value : null));
}

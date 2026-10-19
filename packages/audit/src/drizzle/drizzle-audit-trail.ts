import { sql, type SQL, type TablesRelationalConfig } from 'drizzle-orm';
import { PgTransaction, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { auditTables } from '../sql/audit-tables.js';
import { PostgresAuditTrail } from '../sql/postgres-audit-trail.js';
import { rowsOf } from '../sql/rows-of.js';
import type { SqlSession } from '../sql/sql-session.js';
import type { Sql } from '../sql/sql.js';
import type { AuditTrailOptions } from '../trail/audit-trail-options.js';
import type { DrizzleAuditContext } from './drizzle-audit-context.js';

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
    ambientTransaction: database instanceof PgTransaction ? database : undefined,
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

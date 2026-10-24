import type { EntityManager } from 'typeorm';
import { auditTables } from '../sql/audit-tables';
import type { AuditTablesOptions } from '../sql/audit-tables-options';
import { positionalText } from '../sql/positional-text';
import { PostgresAuditTrail } from '../sql/postgres-audit-trail';
import { rowsOf } from '../sql/rows-of';
import type { SqlSession } from '../sql/sql-session';
import type { AuditTrailOptions } from '../trail/audit-trail-options';
import type { TypeOrmAuditContext } from './type-orm-audit-context';

export interface TypeOrmAuditTrailOptions extends AuditTrailOptions, AuditTablesOptions {}

/**
 * The audit trail on PostgreSQL through TypeORM. It writes on the entity manager of the unit of
 * work: inside a unit of work the entry commits or rolls back with it, outside it is written in a
 * transaction of its own. The tables are the entities `auditEntities` declares, migrated with the
 * others; the guard that keeps them append-only goes in a migration by hand (`auditGuardStatements`).
 */
export class TypeOrmAuditTrail extends PostgresAuditTrail {
  constructor(context: TypeOrmAuditContext, options: TypeOrmAuditTrailOptions = {}) {
    super(() => sessionOn(context.manager()), auditTables(options), options);
  }
}

function sessionOn(manager: EntityManager): SqlSession {
  const runner = manager.queryRunner;

  return {
    ambientTransaction: runner?.isTransactionActive === true ? runner : undefined,
    query: async (statement) => {
      const result: unknown = await manager.query(positionalText(statement), [...statement.values]);

      return rowsOf(result);
    },
    transaction: (work) => manager.transaction((transaction) => work(sessionOn(transaction))),
  };
}

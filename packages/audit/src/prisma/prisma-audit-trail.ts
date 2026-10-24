import { auditTables } from '../sql/audit-tables';
import type { AuditTablesOptions } from '../sql/audit-tables-options';
import { positionalText } from '../sql/positional-text';
import { PostgresAuditTrail } from '../sql/postgres-audit-trail';
import { rowsOf } from '../sql/rows-of';
import type { SqlRow } from '../sql/sql-row';
import type { SqlSession } from '../sql/sql-session';
import type { Sql } from '../sql/sql';
import type { AuditTrailOptions } from '../trail/audit-trail-options';
import type { PrismaAuditClient } from './prisma-audit-client';
import type { PrismaAuditContext } from './prisma-audit-context';
import type { PrismaAuditRootClient } from './prisma-audit-root-client';
import { databaseError } from './database-error';

export interface PrismaAuditTrailOptions extends AuditTrailOptions, AuditTablesOptions {}

/**
 * The audit trail on PostgreSQL through Prisma. Its statements are raw ones, on the client of the
 * unit of work: inside a unit of work the entry commits or rolls back with it, outside it is
 * written in a transaction of its own. Prisma nests no transaction, so an append inside one takes a
 * savepoint. The tables are the ones `auditPrismaModels` declares, migrated with the others; the
 * guard that keeps them append-only goes in a migration by hand (`auditGuardStatements`).
 */
export class PrismaAuditTrail extends PostgresAuditTrail {
  constructor(context: PrismaAuditContext, options: PrismaAuditTrailOptions = {}) {
    super(() => sessionOn(context), auditTables(options), options);
  }
}

let savepoints = 0;

function sessionOn(context: PrismaAuditContext): SqlSession {
  const client = context.client();

  if (context.inTransaction()) {
    return inTransaction(client);
  }

  return {
    ambientTransaction: undefined,
    query: (statement) => queryOn(client, statement),
    transaction: (work) => rootOf(client).$transaction((transaction) => work(inTransaction(transaction))),
  };
}

/** The session of one transaction: the same client object from its begin to its end, a savepoint for an append inside it. */
function inTransaction(client: PrismaAuditClient): SqlSession {
  const session: SqlSession = {
    ambientTransaction: client,
    query: (statement) => queryOn(client, statement),
    transaction: (work) => inSavepoint(client, () => work(session)),
  };

  return session;
}

async function queryOn(client: PrismaAuditClient, statement: Sql): Promise<readonly SqlRow[]> {
  try {
    return rowsOf(await client.$queryRawUnsafe(positionalText(statement), ...statement.values));
  } catch (error) {
    throw databaseError(error);
  }
}

function rootOf(client: PrismaAuditClient): PrismaAuditRootClient {
  if (!isRoot(client)) {
    throw new TypeError('The client of a Prisma context outside a transaction opens none: it is not the root client');
  }

  return client;
}

function isRoot(client: PrismaAuditClient): client is PrismaAuditRootClient {
  return typeof Reflect.get(client, '$transaction') === 'function';
}

async function inSavepoint<T>(client: PrismaAuditClient, work: () => Promise<T>): Promise<T> {
  savepoints += 1;
  const name = `audit_append_${String(savepoints)}`;

  await client.$executeRawUnsafe(`savepoint ${name}`);

  try {
    const result = await work();

    await client.$executeRawUnsafe(`release savepoint ${name}`);

    return result;
  } catch (error) {
    await client.$executeRawUnsafe(`rollback to savepoint ${name}`);

    throw error;
  }
}

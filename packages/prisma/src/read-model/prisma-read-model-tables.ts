import { PostgresReadModelTables, type ReadModelTablesOptions } from '@ddd-ts-kit/kernel';
import type { PrismaRawQueries } from '../outbox/prisma-raw-queries';
import type { PrismaContext } from '../unit-of-work/prisma-context';

/**
 * The read model tables of the database, on PostgreSQL, checked in one pass through the raw
 * queries of the Prisma client: what an application asks at its start, whatever builds its stores
 * and whenever, and what a script asks of the database of a deployment before it. Each table can
 * hold the trace of a deleted row, or is named with its columns and the migration to write.
 */
export function prismaReadModelTables<Tx extends PrismaRawQueries>(
  context: PrismaContext<Tx>,
  options: ReadModelTablesOptions = {},
): PostgresReadModelTables {
  return new PostgresReadModelTables(async (statement, parameters) => {
    const rows: unknown = await context.client().$queryRawUnsafe(statement, ...parameters);
    const list: readonly unknown[] = Array.isArray(rows) ? rows : [];

    return list.filter((row): row is Readonly<Record<string, unknown>> => typeof row === 'object' && row !== null);
  }, options);
}

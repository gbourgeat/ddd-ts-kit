import { postgresEventSourcing, type EventSourcingStores, type EventStoreTablesOptions } from '@ddd-ts-kit/kernel';
import type { PrismaRawQueries } from '../outbox/prisma-raw-queries';
import type { PrismaContext } from '../unit-of-work/prisma-context';

/**
 * The event store, the snapshots, the checkpoints and the keys of the data subjects on
 * PostgreSQL, through the raw queries of the Prisma client, over the models of
 * `prisma/event-store.postgresql.prisma`. Every statement runs on the client of the context, so
 * an append joins the transaction of the unit of work, with the outbox. Bind each one to its port.
 */
export function createPrismaEventSourcing<Tx extends PrismaRawQueries>(
  context: PrismaContext<Tx>,
  options: EventStoreTablesOptions = {},
): EventSourcingStores {
  return postgresEventSourcing(async (statement, parameters) => {
    const rows: unknown = await context.client().$queryRawUnsafe(statement, ...parameters);

    return Array.isArray(rows)
      ? rows.filter((row): row is Readonly<Record<string, unknown>> => typeof row === 'object' && row !== null)
      : [];
  }, options);
}

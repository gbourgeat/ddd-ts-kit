import type { PrismaRawQueries } from '../outbox/prisma-raw-queries';

/** The raw methods of a Prisma client an erasure needs: a query, and a command that answers how many rows it reached. */
export interface PrismaRawCommands extends PrismaRawQueries {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

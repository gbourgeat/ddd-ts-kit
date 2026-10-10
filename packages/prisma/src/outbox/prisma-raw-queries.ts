/** The raw-query method of a Prisma client, needed for the one statement Prisma cannot build. */
export interface PrismaRawQueries {
  $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
}

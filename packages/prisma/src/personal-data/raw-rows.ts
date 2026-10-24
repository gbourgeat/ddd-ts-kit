import type { PrismaRawQueries } from '../outbox/prisma-raw-queries';

/** The rows a raw statement answered, as records. */
export async function rawRows(
  client: PrismaRawQueries,
  statement: string,
  values: readonly unknown[],
): Promise<Readonly<Record<string, unknown>>[]> {
  const rows: unknown = await client.$queryRawUnsafe(statement, ...values);

  return Array.isArray(rows)
    ? rows.filter((row): row is Readonly<Record<string, unknown>> => typeof row === 'object' && row !== null)
    : [];
}

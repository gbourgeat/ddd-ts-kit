import type { PrismaRawQueries } from './prisma-raw-queries.js';

/**
 * How concurrent relays share the pending records.
 * - `compare-and-set`: reads the due records, then takes each with an `updateMany` guarded by
 *   the attempt count it read. Plain Prisma Client calls, on any database, at one statement
 *   per record.
 * - `skip-locked`: one locking select and one update in a short transaction.
 */
export type PrismaOutboxClaim<Tx> = 'compare-and-set' | PrismaSkipLockedClaim<Tx>;

/**
 * Claims with `SELECT ... FOR UPDATE SKIP LOCKED`. Prisma Client has no row-locking API, so
 * that one statement goes through `$queryRawUnsafe`, which is why the store must be told the
 * dialect and the real name of the table. Needs PostgreSQL or MySQL 8.
 */
export interface PrismaSkipLockedClaim<Tx> {
  readonly strategy: 'skip-locked';
  readonly dialect: 'postgresql' | 'mysql';
  /** The raw-query capability of a client: `(client) => client`. */
  readonly raw: (client: Tx) => PrismaRawQueries;
  /** The schema (PostgreSQL) or database (MySQL) of the table. Default: that of the connection. */
  readonly schema?: string;
  /** The table the model is mapped to. Default `outbox`. */
  readonly table?: string;
}

import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { DrizzleContext } from '@ddd-ts-kit/drizzle/postgres';

// Typed on the driver-neutral base, so that the same repositories run on node-postgres in
// production and on PGlite in the tests.
export type Database = PgDatabase<PgQueryResultHKT>;
export type DatabaseContext = DrizzleContext<PgQueryResultHKT>;

export interface DatabaseConnection {
  readonly db: Database;
  close(): Promise<void>;
}

export function connectToDatabase(url: string): DatabaseConnection {
  const db = drizzle(url);
  return { db, close: () => db.$client.end() };
}

import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

export interface DatabaseConnection {
  readonly db: PgDatabase<PgQueryResultHKT>;

  close(): Promise<void>;
}

export function connectToDatabase(url: string): DatabaseConnection {
  const db = drizzle(url);

  return { db, close: () => db.$client.end() };
}

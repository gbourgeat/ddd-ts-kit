import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

export interface DatabaseConnection {
  readonly db: PgDatabase<PgQueryResultHKT>;

  close(): Promise<void>;
}

export interface ConnectionOptions {
  /** Default 10. The tests on a server share its connections between the files that run at once. */
  readonly poolSize?: number;
}

export function connectToDatabase(url: string, options: ConnectionOptions = {}): DatabaseConnection {
  const db = drizzle({ connection: { connectionString: url, max: options.poolSize ?? 10 } });

  return { db, close: () => db.$client.end() };
}

import knex, { type Knex } from 'knex';

export interface DatabaseConnection {
  readonly db: Knex;

  close(): Promise<void>;
}

export interface ConnectionOptions {
  /** Default 10. A single-session database (the in-process one of the tests) needs 1. */
  readonly poolSize?: number;
}

export function connectToDatabase(url: string, options: ConnectionOptions = {}): DatabaseConnection {
  const db = knex({ client: 'pg', connection: url, pool: { min: 0, max: options.poolSize ?? 10 } });

  return { db, close: () => db.destroy() };
}

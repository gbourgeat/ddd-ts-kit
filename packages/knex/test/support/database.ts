import knex, { type Knex } from 'knex';
import { startPostgres } from './postgres.js';

export interface TestDatabase {
  readonly knex: Knex;
  /** Where it is, for a second connection (another role, another pool). */
  readonly url: string;
  /** How many connections the endpoint takes: one on PGlite, several on a real server. */
  readonly poolSize: number;
  /** True on a real server, where several connections make real concurrency possible. */
  readonly real: boolean;
  /** The SQL knex sent since the last truncate, to assert what really reached the database. */
  readonly queries: string[];
  truncate(): Promise<void>;
  close(): Promise<void>;
}

/** One PostgreSQL database with the tables `migrate` creates, the way a migration would. */
export async function createDatabase(
  migrate: (knex: Knex) => Promise<void>,
  tables: readonly string[],
): Promise<TestDatabase> {
  const postgres = await startPostgres();

  const db = knex({
    client: 'pg',
    connection: postgres.url,
    pool: { min: 0, max: postgres.poolSize },
  });

  const queries: string[] = [];

  db.on('query', (query: { sql: string }) => {
    queries.push(query.sql);
  });

  await migrate(db);

  return {
    knex: db,
    url: postgres.url,
    poolSize: postgres.poolSize,
    real: postgres.real,
    queries,
    truncate: async () => {
      await db.raw(`truncate table ${tables.join(', ')} restart identity`);
      queries.length = 0;
    },
    close: async () => {
      await db.destroy();
      await postgres.stop();
    },
  };
}

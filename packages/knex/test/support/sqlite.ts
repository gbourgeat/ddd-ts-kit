import knex, { type Knex } from 'knex';

export interface TestSqliteDatabase {
  readonly knex: Knex;
  truncate(): Promise<void>;
  close(): Promise<void>;
}

/**
 * One in-memory SQLite database with the tables `migrate` creates, the way a migration would.
 * SQLite has no schemas: the tables of a context are told apart by their names.
 */
export async function createSqliteDatabase(
  migrate: (knex: Knex) => Promise<void>,
  tables: readonly string[],
): Promise<TestSqliteDatabase> {
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    // An in-memory database lives as long as its connection: one, kept open until the end.
    pool: { min: 1, max: 1, idleTimeoutMillis: Number.MAX_SAFE_INTEGER },
    useNullAsDefault: true,
  });

  await migrate(db);

  return {
    knex: db,
    truncate: async () => {
      // No TRUNCATE in SQLite: delete the rows, then restart the autoincrement counters.
      for (const table of tables) {
        await db(table).delete();
      }

      await db('sqlite_sequence').whereIn('name', tables).delete();
    },
    close: () => db.destroy(),
  };
}

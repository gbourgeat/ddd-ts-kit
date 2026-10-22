import { PGlite } from '@electric-sql/pglite';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/pglite';
import { createTableSql } from './create-table-sql';
import { quote } from './quote';
import { RecordingLogger } from './recording-logger';

/** One in-process PostgreSQL (PGlite) with the given tables created. */
export async function createDatabase(tables: readonly PgTable[]) {
  const client = new PGlite();
  const logger = new RecordingLogger();

  for (const statement of tables.flatMap(createTableSql)) {
    await client.exec(statement);
  }

  const db = drizzle(client, { logger });

  const truncate = async (): Promise<void> => {
    for (const table of tables) {
      const { schema, name } = getTableConfig(table);

      const target = [schema, name]
        .filter((part) => part !== undefined)
        .map(quote)
        .join('.');

      await client.exec(`truncate table ${target} restart identity`);
    }

    logger.queries.length = 0;
  };

  return { client, db, logger, truncate };
}

import { sql } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { quote } from './quote.js';
import { createContractDatabase, type ContractDatabase } from './read-model/contract-database.js';

export interface StoreDatabase extends ContractDatabase {
  /** Empties the tables, between two tests. */
  truncate(): Promise<void>;
}

/**
 * The database the contracts of the job and process stores run on: PGlite in process by default,
 * the server of `DDD_TS_KIT_TEST_DATABASE_URL` behind a pool of several connections when it is
 * set, so that concurrent claims and saves race over real connections there.
 */
export async function createStoreDatabase(tables: readonly PgTable[]): Promise<StoreDatabase> {
  const database = await createContractDatabase(tables);
  const targets = tables.map(qualifiedName).join(', ');

  return {
    ...database,
    truncate: async () => {
      await database.db.execute(sql.raw(`truncate table ${targets} restart identity`));
      database.logger.queries.length = 0;
    },
  };
}

function qualifiedName(table: PgTable): string {
  const { schema, name } = getTableConfig(table);

  return [schema, name]
    .filter((part) => part !== undefined)
    .map(quote)
    .join('.');
}

import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readModelTablesContract } from '@ddd-ts-kit/testing/contracts';
import { createDrizzleUnitOfWork, drizzleReadModelTables } from '../src/postgres';
import { createContractDatabase, type ContractDatabase } from './support/read-model/contract-database';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: ContractDatabase;

beforeAll(async () => {
  database = await createContractDatabase([]);
});

afterAll(async () => {
  await database.close();
});

readModelTablesContract(runner, {
  name: 'drizzleReadModelTables',
  createTables: () => {
    const unitOfWork = createDrizzleUnitOfWork(database.db);

    return {
      tables: (options) => drizzleReadModelTables(unitOfWork, options),
      execute: (statement) => database.db.execute(sql.raw(statement)),
    };
  },
});

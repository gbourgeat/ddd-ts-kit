import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readModelTablesContract } from '@ddd-ts-kit/testing/contracts';
import { createKnexUnitOfWork, knexReadModelTables } from '../src';
import { createDatabase, type TestDatabase } from './support/database';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(() => Promise.resolve(), []);
});

afterAll(async () => {
  await database.close();
});

readModelTablesContract(runner, {
  name: 'knexReadModelTables',
  createTables: () => {
    const unitOfWork = createKnexUnitOfWork(database.knex);

    return {
      tables: (options) => knexReadModelTables(unitOfWork, options),
      execute: (statement) => database.knex.raw(statement),
    };
  },
});

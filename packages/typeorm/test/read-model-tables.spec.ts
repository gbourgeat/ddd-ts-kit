import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readModelTablesContract } from '@ddd-ts-kit/testing/contracts';
import { createTypeOrmUnitOfWork, typeOrmReadModelTables } from '../src';
import { createDatabase, type TestDatabase } from './support/database';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase([]);
});

afterAll(async () => {
  await database.close();
});

readModelTablesContract(runner, {
  name: 'typeOrmReadModelTables',
  createTables: () => {
    const unitOfWork = createTypeOrmUnitOfWork(database.dataSource);

    return {
      tables: (options) => typeOrmReadModelTables(unitOfWork, options),
      execute: (statement) => database.dataSource.query(statement),
    };
  },
});

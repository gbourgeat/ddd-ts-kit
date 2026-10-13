import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { processStoreContract } from '@ddd-ts-kit/testing/contracts';
import { DrizzleProcessStore, createDrizzleUnitOfWork, processesTable } from '../src/postgres.js';
import { createStoreDatabase, type StoreDatabase } from './support/store-database.js';

const runner = { describe, it, expect, beforeEach, afterEach };
const processes = processesTable('billing');

let database: StoreDatabase;

beforeAll(async () => {
  database = await createStoreDatabase([processes, processesTable()]);
});

afterAll(async () => {
  await database.close();
});

const context = () => createDrizzleUnitOfWork(database.db);

let shared: ReturnType<typeof context>;

processStoreContract(runner, {
  name: 'DrizzleProcessStore in the schema of a context',
  createStore: async () => {
    await database.truncate();
    shared = context();

    return new DrizzleProcessStore(shared, processes);
  },
  unitOfWork: () => shared,
});

processStoreContract(runner, {
  name: 'DrizzleProcessStore in the public schema',
  createStore: async () => {
    await database.truncate();

    return new DrizzleProcessStore(context());
  },
});

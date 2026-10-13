import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { processStoreContract } from '@ddd-ts-kit/testing/contracts';
import { KnexProcessStore, createKnexUnitOfWork, createProcessTable, dropProcessTable } from '../src/index.js';
import { createDatabase, type TestDatabase } from './support/database.js';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(
    async (knex) => {
      await createProcessTable(knex, { schema: 'billing' });
      await createProcessTable(knex, { table: 'billing_processes' });
    },
    ['billing.process_instances', 'billing_processes'],
  );
});

afterAll(async () => {
  await database.close();
});

const context = () => createKnexUnitOfWork(database.knex);

// The store and the unit of work of a test share one context: PGlite has a single connection.
let shared: ReturnType<typeof context>;

processStoreContract(runner, {
  name: 'KnexProcessStore in the schema of a context',
  createStore: async () => {
    await database.truncate();
    shared = context();

    return new KnexProcessStore(shared, { schema: 'billing' });
  },
  unitOfWork: () => shared,
});

processStoreContract(runner, {
  name: 'KnexProcessStore in a table of its own name',
  createStore: async () => {
    await database.truncate();

    return new KnexProcessStore(context(), { table: 'billing_processes' });
  },
});

describe('the table of the process instances', () => {
  it('is dropped by its down migration', async () => {
    await dropProcessTable(database.knex, { table: 'billing_processes' });

    expect(await database.knex.schema.hasTable('billing_processes')).toBe(false);
    await createProcessTable(database.knex, { table: 'billing_processes' });
  });
});

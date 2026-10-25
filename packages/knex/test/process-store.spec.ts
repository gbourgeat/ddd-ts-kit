import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { processStoreContract } from '@ddd-ts-kit/testing/contracts';
import { KnexProcessStore, createKnexUnitOfWork, createProcessTable, dropProcessTable } from '../src';
import { createDatabase, type TestDatabase } from './support/database';

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
  storeInTenant: (tenant) => new KnexProcessStore(shared, { schema: 'billing', tenant }),
});

processStoreContract(runner, {
  name: 'KnexProcessStore in a table of its own name',
  createStore: async () => {
    await database.truncate();

    return new KnexProcessStore(context(), { table: 'billing_processes' });
  },
});

describe('the state of a process instance', () => {
  it('comes back null when it was saved without one', async () => {
    await database.truncate();

    const store = new KnexProcessStore(context(), { table: 'billing_processes' });
    const started = { name: 'billing.dunning', id: 'inv-1', version: 1, ended: false, timeouts: {} };

    await store.save({ ...started, state: { step: 1 } });
    await store.save({ ...started, version: 2, state: undefined });

    expect(await store.load(started.name, started.id)).toMatchObject({ version: 2, state: null });
  });
});

describe('the table of the process instances', () => {
  it('is dropped by its down migration', async () => {
    await dropProcessTable(database.knex, { table: 'billing_processes' });

    expect(await database.knex.schema.hasTable('billing_processes')).toBe(false);
    await createProcessTable(database.knex, { table: 'billing_processes' });
  });

  it('is dropped under its default name when its down migration is given none', async () => {
    await createProcessTable(database.knex);
    await dropProcessTable(database.knex);

    expect(await database.knex.schema.hasTable('process_instances')).toBe(false);
  });
});

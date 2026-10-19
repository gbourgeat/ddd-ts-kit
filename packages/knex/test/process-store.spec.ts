import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConcurrencyError, NoCurrentTenantError, type StoredProcess } from '@ddd-ts-kit/kernel';
import { processStoreContract } from '@ddd-ts-kit/testing/contracts';
import { KnexProcessStore, createKnexUnitOfWork, createProcessTable, dropProcessTable } from '../src/index.js';
import { createDatabase, type TestDatabase } from './support/database.js';
import { ada, bob, eve, nobody, scopeOf } from './support/scopes.js';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(
    async (knex) => {
      await createProcessTable(knex, { schema: 'billing' });
      await createProcessTable(knex, { table: 'billing_processes' });
      await createProcessTable(knex, { table: 'tenant_processes', tenant: true });
    },
    ['billing.process_instances', 'billing_processes', 'tenant_processes'],
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

processStoreContract(runner, {
  name: 'KnexProcessStore in the tenant of the work',
  createStore: async () => {
    await database.truncate();
    shared = context();

    return new KnexProcessStore(shared, { table: 'tenant_processes', tenant: scopeOf(ada) });
  },
  unitOfWork: () => shared,
});

describe('the process instances of a tenant', () => {
  const started: StoredProcess = {
    name: 'billing.dunning',
    id: 'inv-1',
    state: { step: 1 },
    version: 1,
    ended: false,
    timeouts: {},
  };

  const storeOf = (actor: typeof ada) =>
    new KnexProcessStore(context(), { table: 'tenant_processes', tenant: scopeOf(actor) });

  beforeEach(async () => {
    await database.truncate();
    await storeOf(ada).save(started);
  });

  it('are found and changed by the work of their tenant', async () => {
    await storeOf(bob).save({ ...started, version: 2, state: { step: 2 } });

    expect(await storeOf(ada).load(started.name, started.id)).toMatchObject({ version: 2, state: { step: 2 } });
  });

  it('are neither found nor changed by another tenant, whoever knows their key', async () => {
    const other = storeOf(eve);

    expect(await other.load(started.name, started.id)).toBeUndefined();
    await expect(other.save({ ...started, version: 2 })).rejects.toBeInstanceOf(ConcurrencyError);
    await expect(other.save(started)).rejects.toBeInstanceOf(ConcurrencyError);
    expect(await storeOf(ada).load(started.name, started.id)).toMatchObject({ version: 1 });
  });

  it('refuse work that names no tenant', async () => {
    await expect(storeOf(nobody).load(started.name, started.id)).rejects.toBeInstanceOf(NoCurrentTenantError);
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

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedExecutionScope } from '@ddd-ts-kit/kernel';
import { eventStoreContract, eventStoreUnitOfWorkContract } from '@ddd-ts-kit/testing/contracts';
import {
  KnexOutboxStore,
  addEventStoreTenantColumn,
  createEventStoreTables,
  createKnexEventSourcing,
  createKnexUnitOfWork,
  createOutboxTables,
} from '../src';
import { createDatabase, type TestDatabase } from './support/database';

const runner = { describe, it, expect, beforeEach, afterEach };

const TABLES = [
  'scheduling.stored_events',
  'scheduling.stored_events_head',
  'scheduling.stream_snapshots',
  'scheduling.subscription_checkpoints',
  'scheduling.subject_keys',
  'outbox',
  'processed_events',
];

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(async (db) => {
    await createEventStoreTables(db, { schema: 'scheduling' });
    await createEventStoreTables(db, { schema: 'scheduling' });
    await createOutboxTables(db);
  }, TABLES);
});

afterAll(async () => {
  await database.close();
});

const stores = async () => {
  await database.truncate();

  return createKnexEventSourcing(createKnexUnitOfWork(database.knex), { schema: 'scheduling' });
};

eventStoreContract(runner, {
  name: 'createKnexEventSourcing on PostgreSQL',
  createStore: async () => (await stores()).events,
  createCompanions: stores,
  createTenantStore: async () => {
    await database.truncate();

    const scope = new FixedExecutionScope();

    return {
      scope,
      store: createKnexEventSourcing(createKnexUnitOfWork(database.knex), { schema: 'scheduling', scope }).events,
    };
  },
});

eventStoreUnitOfWorkContract(runner, {
  name: 'createKnexEventSourcing on PostgreSQL',
  createSubject: async () => {
    await database.truncate();

    const unitOfWork = createKnexUnitOfWork(database.knex);

    return {
      unitOfWork,
      store: createKnexEventSourcing(unitOfWork, { schema: 'scheduling' }).events,
      outbox: new KnexOutboxStore(unitOfWork),
    };
  },
});

describe('addEventStoreTenantColumn', () => {
  it('adds the column to the events of a store created without it, and gives the streams there to the tenant named', async () => {
    await database.truncate();
    await database.knex.raw('alter table scheduling.stored_events drop column tenant_id');

    await database.knex('stored_events').withSchema('scheduling').insert({
      position: 1,
      stream: 's-1',
      version: 1,
      event_id: 'old',
      type: 't',
      schema_version: 1,
      data: '{}',
      metadata: '{}',
      occurred_at: new Date(),
    });

    await addEventStoreTenantColumn(database.knex, { schema: 'scheduling', tenantOfExistingStreams: 'acme' });
    await addEventStoreTenantColumn(database.knex, { schema: 'scheduling' });

    expect(await database.knex('stored_events').withSchema('scheduling').select('event_id', 'tenant_id')).toEqual([
      { event_id: 'old', tenant_id: 'acme' },
    ]);
  });
});

describe('createKnexEventSourcing', () => {
  it('refuses a knex that does not speak PostgreSQL', () => {
    const mysql = { executor: () => ({ client: { dialect: 'mysql' } }), inTransaction: () => false };

    expect(() => createKnexEventSourcing(mysql as never)).toThrow('runs on PostgreSQL, and this knex speaks mysql');
  });
});

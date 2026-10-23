import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eventStoreContract, eventStoreUnitOfWorkContract } from '@ddd-ts-kit/testing/contracts';
import {
  KnexOutboxStore,
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

describe('createKnexEventSourcing', () => {
  it('refuses a knex that does not speak PostgreSQL', () => {
    const mysql = { executor: () => ({ client: { dialect: 'mysql' } }), inTransaction: () => false };

    expect(() => createKnexEventSourcing(mysql as never)).toThrow('runs on PostgreSQL, and this knex speaks mysql');
  });
});

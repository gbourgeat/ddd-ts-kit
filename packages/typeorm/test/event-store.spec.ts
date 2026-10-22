import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eventStoreContract, eventStoreUnitOfWorkContract } from '@ddd-ts-kit/testing/contracts';
import {
  TypeOrmOutboxStore,
  createTypeOrmEventSourcing,
  createTypeOrmUnitOfWork,
  eventStoreEntities,
  outboxEntity,
} from '../src';
import { createDatabase, type TestDatabase } from './support/database';

const runner = { describe, it, expect, beforeEach, afterEach };
const outbox = outboxEntity();

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase([...eventStoreEntities({ schema: 'scheduling' }), outbox]);
});

afterAll(async () => {
  await database.close();
});

const stores = async () => {
  await database.truncate();

  return createTypeOrmEventSourcing(createTypeOrmUnitOfWork(database.dataSource), { schema: 'scheduling' });
};

// The tables come from the entities the package ships, synchronized as a generated migration would create them.
eventStoreContract(runner, {
  name: 'createTypeOrmEventSourcing on PostgreSQL',
  createStore: async () => (await stores()).events,
  createCompanions: stores,
});

eventStoreUnitOfWorkContract(runner, {
  name: 'createTypeOrmEventSourcing on PostgreSQL',
  createSubject: async () => {
    await database.truncate();

    const unitOfWork = createTypeOrmUnitOfWork(database.dataSource);

    return {
      unitOfWork,
      store: createTypeOrmEventSourcing(unitOfWork, { schema: 'scheduling' }).events,
      outbox: new TypeOrmOutboxStore(unitOfWork, { entity: outbox }),
    };
  },
});

describe('createTypeOrmEventSourcing', () => {
  it('refuses a data source that is not PostgreSQL', async () => {
    const mysql = { manager: () => ({ dataSource: { options: { type: 'mysql' } } }), inTransaction: () => false };
    const { events } = createTypeOrmEventSourcing(mysql as never);

    await expect(events.head()).rejects.toThrow('runs on PostgreSQL, not on mysql');
  });
});

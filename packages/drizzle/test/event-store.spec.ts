import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eventStoreContract, eventStoreUnitOfWorkContract } from '@ddd-ts-kit/testing/contracts';
import {
  DrizzleOutboxStore,
  createDrizzleEventSourcing,
  createDrizzleUnitOfWork,
  eventStoreTables,
  outboxTable,
} from '../src/postgres';
import { createDatabase } from './support/database';

const runner = { describe, it, expect, beforeEach, afterEach };
const store = eventStoreTables('scheduling');
const outbox = outboxTable();

let database: Awaited<ReturnType<typeof createDatabase>>;

beforeAll(async () => {
  database = await createDatabase([
    store.head,
    store.events,
    store.snapshots,
    store.checkpoints,
    store.subjectKeys,
    outbox,
  ]);
});

afterAll(async () => {
  await database.client.close();
});

const stores = async () => {
  await database.truncate();

  return createDrizzleEventSourcing(createDrizzleUnitOfWork(database.db), { schema: 'scheduling' });
};

// The tables come from the drizzle definitions the package ships: the statements of the kernel run on them.
eventStoreContract(runner, {
  name: 'createDrizzleEventSourcing on PGlite',
  createStore: async () => (await stores()).events,
  createCompanions: stores,
});

eventStoreUnitOfWorkContract(runner, {
  name: 'createDrizzleEventSourcing on PGlite',
  createSubject: async () => {
    await database.truncate();

    const unitOfWork = createDrizzleUnitOfWork(database.db);

    return {
      unitOfWork,
      store: createDrizzleEventSourcing(unitOfWork, { schema: 'scheduling' }).events,
      outbox: new DrizzleOutboxStore(unitOfWork, { table: outbox }),
    };
  },
});

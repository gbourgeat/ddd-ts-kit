import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eventStoreContract, eventStoreUnitOfWorkContract } from '@ddd-ts-kit/testing/contracts';
import { PrismaOutboxStore, createPrismaEventSourcing, createPrismaUnitOfWork } from '../../src';
import { createDatabase, type TestDatabase } from '../support/database';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase();
});

afterAll(async () => {
  await database.close();
});

const stores = async () => {
  await database.truncate();

  return createPrismaEventSourcing(createPrismaUnitOfWork(database.prisma));
};

// The tables come from the models the package ships, through `prisma migrate diff`: the statements of the kernel run on them.
eventStoreContract(runner, {
  name: 'createPrismaEventSourcing on PostgreSQL',
  createStore: async () => (await stores()).events,
  createCompanions: stores,
});

eventStoreUnitOfWorkContract(runner, {
  name: 'createPrismaEventSourcing on PostgreSQL',
  createSubject: async () => {
    await database.truncate();

    const unitOfWork = createPrismaUnitOfWork(database.prisma);

    return {
      unitOfWork,
      store: createPrismaEventSourcing(unitOfWork).events,
      outbox: new PrismaOutboxStore(unitOfWork, {
        delegate: (client) => client.outboxRecord,
        claim: { strategy: 'skip-locked', dialect: 'postgresql', raw: (client) => client },
      }),
    };
  },
});

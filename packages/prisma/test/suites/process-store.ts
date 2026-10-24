import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { processStoreContract } from '@ddd-ts-kit/testing/contracts';
import { PrismaProcessStore, createPrismaUnitOfWork } from '../../src';
import { createDatabase, type TestDatabase } from '../support/database';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase();
});

afterAll(async () => {
  await database.close();
});

const unitOfWork = () => createPrismaUnitOfWork(database.prisma);

/** The process instances of the `messaging` schema: the renamed copy of the shipped model. */
const messagingProcesses = (shared = unitOfWork()) =>
  new PrismaProcessStore(shared, { delegate: (client) => client.messagingProcessInstance });

let shared: ReturnType<typeof unitOfWork>;

processStoreContract(runner, {
  name: 'PrismaProcessStore in a schema of its own',
  createStore: async () => {
    await database.truncate();
    shared = unitOfWork();

    return messagingProcesses(shared);
  },
  unitOfWork: () => shared,
});

processStoreContract(runner, {
  name: 'PrismaProcessStore in the default schema',
  createStore: async () => {
    await database.truncate();

    return new PrismaProcessStore(unitOfWork(), { delegate: (client) => client.processInstance });
  },
});

const started = { name: 'billing.dunning', id: 'inv-1', version: 1, ended: false, timeouts: {} };

describe('the state of a process instance', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('comes back null when it was saved without one', async () => {
    const store = messagingProcesses();

    await store.save({ ...started, state: { step: 1 } });
    await store.save({ ...started, version: 2, state: undefined });

    expect(await store.load(started.name, started.id)).toMatchObject({ version: 2, state: null });
  });

  it.each([
    ['a list', `'["job-1"]'`, 'timeouts'],
    ['a timeout that names no job', `'{"second-reminder":7}'`, 'second-reminder'],
  ])('is refused when its timeouts are %s', async (_, timeouts, message) => {
    const store = messagingProcesses();

    await store.save({ ...started, state: {} });
    await database.prisma.$executeRawUnsafe(`update messaging.process_instances set timeouts = ${timeouts}`);

    await expect(store.load(started.name, started.id)).rejects.toThrow(message);
  });
});

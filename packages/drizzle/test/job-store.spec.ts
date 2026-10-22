import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { jobStoreContract } from '@ddd-ts-kit/testing/contracts';
import { DrizzleJobStore, createDrizzleUnitOfWork, jobsTable } from '../src/postgres';
import { createStoreDatabase, type StoreDatabase } from './support/store-database';

const runner = { describe, it, expect, beforeEach, afterEach };
const jobs = jobsTable('billing');
const publicJobs = jobsTable();

let database: StoreDatabase;

beforeAll(async () => {
  database = await createStoreDatabase([jobs, publicJobs]);
});

afterAll(async () => {
  await database.close();
});

const context = () => createDrizzleUnitOfWork(database.db);

let shared: ReturnType<typeof context>;

jobStoreContract(runner, {
  name: 'DrizzleJobStore in the schema of a context',
  createStore: async () => {
    await database.truncate();
    shared = context();

    return new DrizzleJobStore(shared, jobs);
  },
  unitOfWork: () => shared,
});

jobStoreContract(runner, {
  name: 'DrizzleJobStore in the public schema',
  createStore: async () => {
    await database.truncate();

    return new DrizzleJobStore(context());
  },
});

describe('DrizzleJobStore, past the contract', () => {
  it('forgets a checkpoint set back to nothing', async () => {
    await database.truncate();

    const store = new DrizzleJobStore(context(), jobs);
    const at = new Date('2026-03-01T10:00:00.000Z');
    const actor = { id: 'a', type: 'user' as const, roles: [], attributes: {} };

    await store.add({
      id: 'job-1',
      name: 'billing.x',
      queue: 'billing',
      payload: null,
      enqueuedBy: { correlationId: 'c', actor },
      enqueuedAt: at,
      runAt: at,
    });

    await store.claim({ queue: 'billing', limit: 1, now: at, leaseMs: 1_000 });
    await store.update({ id: 'job-1', attempt: 1 }, { checkpoint: 'half' }, at);
    await store.update({ id: 'job-1', attempt: 1 }, { checkpoint: undefined }, at);
    await store.release({ id: 'job-1', attempt: 1 }, at);

    const [claimed] = await store.claim({ queue: 'billing', limit: 1, now: at, leaseMs: 1_000 });

    expect(claimed?.checkpoint).toBe(undefined);
  });
});

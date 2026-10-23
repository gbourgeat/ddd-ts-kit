import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { jobStoreContract } from '@ddd-ts-kit/testing/contracts';
import { KnexJobStore, createJobTable, createKnexUnitOfWork, dropJobTable } from '../src';
import { createDatabase, type TestDatabase } from './support/database';

const runner = { describe, it, expect, beforeEach, afterEach };

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase(
    async (knex) => {
      await createJobTable(knex, { schema: 'billing' });
      await createJobTable(knex);
    },
    ['billing.background_jobs', 'background_jobs'],
  );
});

afterAll(async () => {
  await database.close();
});

const context = () => createKnexUnitOfWork(database.knex);

// The store and the unit of work of a test share one context: PGlite has a single connection.
let shared: ReturnType<typeof context>;

jobStoreContract(runner, {
  name: 'KnexJobStore in the schema of a context',
  createStore: async () => {
    await database.truncate();
    shared = context();

    return new KnexJobStore(shared, { schema: 'billing' });
  },
  unitOfWork: () => shared,
});

describe('KnexJobStore sharing the unit of work of the command', () => {
  it('writes the job with the transaction of the unit of work it is given', async () => {
    await database.truncate();

    const unitOfWork = context();
    const store = new KnexJobStore(unitOfWork);

    const job = {
      id: 'job-1',
      name: 'billing.compile-statements',
      queue: 'billing',
      payload: [1, 2],
      enqueuedBy: { correlationId: 'c', actor: { id: 'a', type: 'user' as const, roles: [], attributes: {} } },
      enqueuedAt: new Date('2026-03-01T10:00:00.000Z'),
      runAt: new Date('2026-03-01T10:00:00.000Z'),
    };

    await expect(
      unitOfWork.run(async () => {
        await store.add(job);
        throw new Error('refused');
      }),
    ).rejects.toThrow('refused');

    expect(await store.find('job-1')).toBe(undefined);
    await unitOfWork.run(() => store.add(job));

    const [claimed] = await store.claim({ queue: 'billing', limit: 1, now: job.runAt, leaseMs: 1_000 });

    expect(claimed?.payload).toEqual([1, 2]);
  });

  it('claims nothing, without a query, for a limit of zero', async () => {
    await database.truncate();
    database.queries.length = 0;

    const claimed = await new KnexJobStore(context()).claim({
      queue: 'billing',
      limit: 0,
      now: new Date(),
      leaseMs: 1_000,
    });

    expect([claimed, database.queries]).toEqual([[], []]);
  });

  it('drops the table of the default name when it is given none', async () => {
    await dropJobTable(database.knex);
    const dropped = !(await database.knex.schema.hasTable('background_jobs'));

    await createJobTable(database.knex);

    expect(dropped).toBe(true);
  });

  it('drops the table it created, and leaves the schema', async () => {
    await dropJobTable(database.knex, { table: 'background_jobs' });
    await createJobTable(database.knex);

    expect(await database.knex.schema.hasTable('background_jobs')).toBe(true);
  });
});

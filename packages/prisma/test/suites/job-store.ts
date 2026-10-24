import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NewJob } from '@ddd-ts-kit/scheduling';
import { jobStoreContract } from '@ddd-ts-kit/testing/contracts';
import { PrismaJobStore, createPrismaUnitOfWork } from '../../src';
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

/** The jobs of the `messaging` schema: the renamed copy of the shipped model. */
const messagingJobs = (shared = unitOfWork()) =>
  new PrismaJobStore(shared, { delegate: (client) => client.messagingBackgroundJob, schema: 'messaging' });

// The store and the unit of work of a test share one: the contract rolls back what the store wrote.
let shared: ReturnType<typeof unitOfWork>;

jobStoreContract(runner, {
  name: 'PrismaJobStore in a schema of its own',
  createStore: async () => {
    await database.truncate();
    shared = unitOfWork();

    return messagingJobs(shared);
  },
  unitOfWork: () => shared,
});

jobStoreContract(runner, {
  name: 'PrismaJobStore in the default schema',
  createStore: async () => {
    await database.truncate();

    return new PrismaJobStore(unitOfWork(), { delegate: (client) => client.backgroundJob });
  },
});

const NOW = new Date('2026-03-01T10:00:00.000Z');

const aJob = (id: string, payload: unknown = { month: '2026-02' }): NewJob => ({
  id,
  name: 'billing.compile-statements',
  queue: 'billing',
  payload,
  enqueuedBy: { correlationId: 'c', actor: { id: 'a', type: 'user', roles: [], attributes: {} } },
  enqueuedAt: NOW,
  runAt: NOW,
});

const claim = (store: ReturnType<typeof messagingJobs>) =>
  store.claim({ queue: 'billing', limit: 10, now: NOW, leaseMs: 1_000 });

describe('PrismaJobStore.claim', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('locks the due rows with FOR UPDATE SKIP LOCKED, then leases and reads them in the same transaction', async () => {
    const store = messagingJobs();

    await store.add(aJob('job-1'));
    database.queries.length = 0;

    await claim(store);

    // Prisma logs the end of an interactive transaction, not its BEGIN.
    expect(database.queries).toEqual([
      'select "id" from "messaging"."background_jobs" where "queue" = $1 and (("status" = \'waiting\' and "run_at" <= $2) or ("status" = \'running\' and "lease_until" <= $2)) order by "run_at", "sequence" limit $3 for update skip locked',
      expect.stringMatching(/^UPDATE "messaging"\."background_jobs" SET "status" = \$1, "attempts" = /),
      expect.stringMatching(
        /^SELECT .* FROM "messaging"\."background_jobs" WHERE "messaging"\."background_jobs"\."id" IN/,
      ),
      'COMMIT',
    ]);
  });

  it('sends nothing for a limit of zero', async () => {
    const claimed = await messagingJobs().claim({ queue: 'billing', limit: 0, now: NOW, leaseMs: 1_000 });

    expect([claimed, database.queries]).toEqual([[], []]);
  });

  it('quotes the table it is told, so that its name cannot carry a statement', async () => {
    const table = 'background_jobs"; drop table messaging.outbox; --';
    const store = new PrismaJobStore(unitOfWork(), { delegate: (client) => client.backgroundJob, table });

    await expect(claim(store)).rejects.toThrow(/does not exist/);
    expect(await database.prisma.messagingOutboxRecord.count()).toBe(0);
  });
});

describe('the JSON of a job', () => {
  beforeEach(async () => {
    await database.truncate();
  });

  it('keeps the payload as JSON, a date as its ISO text, the way the other SQL stores do', async () => {
    const store = messagingJobs();

    await store.add(aJob('job-1', { month: '2026-02', closedAt: NOW, draft: undefined }));

    expect((await claim(store))[0]?.payload).toEqual({ month: '2026-02', closedAt: NOW.toISOString() });
  });

  it('keeps a null payload', async () => {
    const store = messagingJobs();

    await store.add(aJob('job-1', null));

    expect((await claim(store))[0]?.payload).toBe(null);
  });

  it('hands no checkpoint to the next attempt once the worker cleared it', async () => {
    const store = messagingJobs();

    await store.add(aJob('job-1'));
    await claim(store);
    await store.update({ id: 'job-1', attempt: 1 }, { checkpoint: { after: 'c-1' } }, NOW);
    await store.update({ id: 'job-1', attempt: 1 }, { checkpoint: undefined }, NOW);

    const [next] = await claim(store);

    expect([next?.attempt, next !== undefined && 'checkpoint' in next]).toEqual([2, false]);
  });

  it('shows a progress without its total while the job does not know it', async () => {
    const store = messagingJobs();

    await store.add(aJob('job-1'));
    await claim(store);
    await store.update({ id: 'job-1', attempt: 1 }, { progress: { done: 3 } }, NOW);

    expect((await store.find('job-1'))?.progress).toEqual({ done: 3 });
  });

  it.each([
    ['a status it does not write', `update messaging.background_jobs set status = 'paused'`, 'status "paused"'],
    [
      'an author without an actor',
      `update messaging.background_jobs set enqueued_by = '{"correlationId":"c"}'`,
      'enqueued',
    ],
    ['a progress without what is done', `update messaging.background_jobs set progress = '{"total":3}'`, 'progress'],
  ])('refuses a row with %s', async (_, change, message) => {
    const store = messagingJobs();

    await store.add(aJob('job-1'));
    await database.prisma.$executeRawUnsafe(change);

    const read = async () => {
      await store.find('job-1');
      await claim(store);
    };

    await expect(read()).rejects.toThrow(message);
  });
});

describe('the shipped schema fragment of the jobs', () => {
  it('makes (name, tenant_id, idempotency_key) unique and indexes the claim', async () => {
    const rows = await database.prisma.$queryRaw<{ indexdef: string }[]>`
      select indexdef from pg_indexes
      where schemaname = 'messaging' and tablename = 'background_jobs' order by indexname`;

    expect(rows.map((row) => row.indexdef)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/UNIQUE INDEX background_jobs_idempotency_key .* \(name, tenant_id, idempotency_key\)$/),
        expect.stringMatching(/INDEX background_jobs_due_idx .* \(queue, run_at, sequence\)$/),
      ]),
    );
  });
});

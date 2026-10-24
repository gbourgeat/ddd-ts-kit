import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NewJob } from '@ddd-ts-kit/scheduling';
import { jobStoreContract } from '@ddd-ts-kit/testing/contracts';
import { TypeOrmJobStore, createTypeOrmUnitOfWork, jobEntity } from '../src';
import { createDatabase, type TestDatabase } from './support/database';

const runner = { describe, it, expect, beforeEach, afterEach };
const messagingJobs = jobEntity({ schema: 'messaging' });

let database: TestDatabase;

beforeAll(async () => {
  database = await createDatabase([messagingJobs, jobEntity()]);
});

afterAll(async () => {
  await database.close();
});

const context = () => createTypeOrmUnitOfWork(database.dataSource);

// The store and the unit of work of a test share one context: the contract rolls back what the store wrote.
let shared: ReturnType<typeof context>;

jobStoreContract(runner, {
  name: 'TypeOrmJobStore in the schema of a context',
  createStore: async () => {
    await database.truncate();
    shared = context();

    return new TypeOrmJobStore(shared, { entity: messagingJobs });
  },
  unitOfWork: () => shared,
});

jobStoreContract(runner, {
  name: 'TypeOrmJobStore in the default schema',
  createStore: async () => {
    await database.truncate();

    return new TypeOrmJobStore(context());
  },
});

const NOW = new Date('2026-03-01T10:00:00.000Z');

const aJob = (id: string, payload: unknown): NewJob => ({
  id,
  name: 'billing.compile-statements',
  queue: 'billing',
  payload,
  enqueuedBy: { correlationId: 'c', actor: { id: 'a', type: 'user', roles: [], attributes: {} } },
  enqueuedAt: NOW,
  runAt: NOW,
});

describe('TypeOrmJobStore', () => {
  const store = () => new TypeOrmJobStore(context(), { entity: messagingJobs });
  const claim = (jobs: TypeOrmJobStore) => jobs.claim({ queue: 'billing', limit: 10, now: NOW, leaseMs: 1_000 });

  beforeEach(async () => {
    await database.truncate();
  });

  it('locks the due rows with FOR UPDATE SKIP LOCKED inside one transaction', async () => {
    const jobs = store();

    await jobs.add(aJob('job-1', {}));
    database.queries.length = 0;

    await claim(jobs);

    expect(database.queries).toEqual([
      'START TRANSACTION',
      expect.stringMatching(/^SELECT .* FROM "messaging"\."background_jobs" .* FOR UPDATE SKIP LOCKED$/),
      expect.stringMatching(/^UPDATE "messaging"\."background_jobs" SET "status" = \$1, "attempts" = "attempts" \+ 1/),
      'COMMIT',
    ]);
  });

  it('sends nothing for a limit of zero', async () => {
    const claimed = await store().claim({ queue: 'billing', limit: 0, now: NOW, leaseMs: 1_000 });

    expect([claimed, database.queries]).toEqual([[], []]);
  });

  it('keeps a list, a null and a date of a payload as JSON', async () => {
    const jobs = store();

    await jobs.add(aJob('job-1', [1, 2]));
    await jobs.add(aJob('job-2', null));
    await jobs.add(aJob('job-3', { closedAt: NOW }));

    expect((await claim(jobs)).map((job) => job.payload)).toEqual([[1, 2], null, { closedAt: NOW.toISOString() }]);
  });

  it('hands no checkpoint to the next attempt once the worker cleared it', async () => {
    const jobs = store();

    await jobs.add(aJob('job-1', {}));
    await claim(jobs);
    await jobs.update({ id: 'job-1', attempt: 1 }, { checkpoint: { after: 'c-1' } }, NOW);
    await jobs.update({ id: 'job-1', attempt: 1 }, { checkpoint: undefined }, NOW);

    const [next] = await claim(jobs);

    expect([next?.attempt, next !== undefined && 'checkpoint' in next]).toEqual([2, false]);
  });
});

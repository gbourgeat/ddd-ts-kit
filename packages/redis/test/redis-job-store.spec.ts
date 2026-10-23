import type { Redis } from 'ioredis';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryErrorReporter, InMemoryLogger, InMemoryUnitOfWork } from '@ddd-ts-kit/kernel';
import { jobStoreContract } from '@ddd-ts-kit/testing/contracts';
import { RedisJobStore, reportLostJobs } from '../src';
import { SERVERS, aNamespace, closeAll, connect, connectToNothing, serverOf } from './support/servers';

const runner = { describe, it, expect, beforeEach, afterEach };

afterAll(closeAll);

const job = {
  id: 'job-1',
  name: 'billing.compile-statements',
  queue: 'billing',
  payload: { customers: [] },
  enqueuedBy: { correlationId: 'c', actor: { id: 'a', type: 'user' as const, roles: [], attributes: {} } },
  enqueuedAt: new Date('2026-03-01T10:00:00.000Z'),
  runAt: new Date('2026-03-01T10:00:00.000Z'),
};

describe.each(SERVERS)('RedisJobStore, %s', (_name, start) => {
  const redis = serverOf(start);

  let client: Redis;

  beforeEach(() => {
    client ??= connect(redis.url);
  });

  jobStoreContract(runner, {
    name: 'RedisJobStore',
    createStore: () => new RedisJobStore(client, { namespace: aNamespace() }),
    unitOfWork: () => new InMemoryUnitOfWork(),
  });

  it('keeps an empty list as a list, in the payload and in the actor', async () => {
    const store = new RedisJobStore(client, { namespace: aNamespace() });

    await store.add(job);

    const [claimed] = await store.claim({ queue: 'billing', limit: 1, now: job.runAt, leaseMs: 1_000 });

    expect([claimed?.payload, claimed?.enqueuedBy.actor.roles]).toEqual([{ customers: [] }, []]);
  });

  it('shows neither the client nor its options', () => {
    const store = new RedisJobStore(client);

    expect([JSON.stringify(store), Object.keys(store)]).toEqual(['"RedisJobStore [client concealed]"', []]);
  });
});

describe('RedisJobStore whose server is away', () => {
  it('tells who wired it of a job a committed unit of work could not write', async () => {
    const lost: string[] = [];
    const store = new RedisJobStore(connectToNothing(), { onLostJob: (_error, id) => lost.push(id) });

    await new InMemoryUnitOfWork().run(() => store.add(job));

    expect(lost).toEqual(['job-1']);
  });

  it('logs and reports a lost write through the reporter a platform wires', async () => {
    const [logger, errors] = [new InMemoryLogger(), new InMemoryErrorReporter()];
    const store = new RedisJobStore(connectToNothing(), { onLostJob: reportLostJobs(logger, errors) });

    await new InMemoryUnitOfWork().run(() => store.add(job));

    expect(logger.entries).toMatchObject([{ level: 'error', fields: { jobId: 'job-1' } }]);
    expect(errors.reports).toMatchObject([{ report: { origin: 'queue', operation: 'background job write' } }]);
  });
});

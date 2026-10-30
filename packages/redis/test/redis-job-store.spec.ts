import type { Redis } from 'ioredis';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  InMemoryErrorReporter,
  InMemoryLogger,
  InMemoryUnitOfWork,
  SequentialIdGenerator,
  err,
  ok,
  type BackgroundJobPayloadSchema,
} from '@ddd-ts-kit/kernel';
import { QueueWorker, StoredJobQueue } from '@ddd-ts-kit/scheduling';
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

interface Statements {
  readonly customers: readonly string[];
  readonly month: string;
}

/** The schema of the job since the deploy that added the month. */
const statements: BackgroundJobPayloadSchema<Statements> = {
  parse(input) {
    const { customers, month } = Object(input) as { customers?: string[]; month?: unknown };

    return typeof month === 'string' && Array.isArray(customers)
      ? ok({ customers, month })
      : err([{ path: 'month', code: 'invalid_type', message: 'A month is expected.' }]);
  },
};

/** The job as the version before that deploy enqueued it: customers only. */
class CompileStatementsBeforeTheDeploy {
  static readonly jobName = 'billing.compile-statements';

  static readonly payload: BackgroundJobPayloadSchema<{ readonly customers: readonly string[] }> = {
    parse: (input) => ok(Object(input) as { customers: string[] }),
  };

  async run(): Promise<void> {
    return undefined;
  }
}

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

  it('gives back a payload of an earlier shape that the worker refuses to run: the job is dead with its reason', async () => {
    const store = new RedisJobStore(client, { namespace: aNamespace() });
    const [clock, scope] = [new FixedClock(job.runAt), new AsyncLocalStorageExecutionScope()];
    const queue = new StoredJobQueue({ store, clock, scope, ids: new SequentialIdGenerator('job') });
    const worker = new QueueWorker({ store, clock, scope });
    const ran: unknown[] = [];

    worker.register({
      name: job.name,
      payload: statements,
      run: async (payload) => {
        ran.push(payload);
      },
    });

    await queue.enqueue(CompileStatementsBeforeTheDeploy, { customers: ['c-1'] });

    expect(await worker.runDue()).toMatchObject([
      { jobId: 'job-1', outcome: 'dead', errorCode: 'INVALID_JOB_PAYLOAD' },
    ]);

    expect(ran).toEqual([]);
    expect(await queue.find('job-1')).toMatchObject({ status: 'dead', lastErrorCode: 'INVALID_JOB_PAYLOAD' });
  });

  it('shows neither the client nor its options', () => {
    const store = new RedisJobStore(client);

    expect([JSON.stringify(store), Object.keys(store)]).toEqual(['"RedisJobStore [client concealed]"', []]);
  });

  it('tells who wired it of each job of a batch a committed unit of work could not write', async () => {
    const lost: string[] = [];
    const own = connect(redis.url);
    const store = new RedisJobStore(own, { namespace: aNamespace(), onLostJob: (_error, id) => lost.push(id) });

    for (const id of ['job-1', 'job-2']) {
      await store.add({ ...job, id });
    }

    for (const { id, attempt } of await store.claim({ queue: 'billing', limit: 2, now: job.runAt, leaseMs: 1_000 })) {
      await store.fail({ id, attempt }, { errorCode: 'LEDGER_DOWN', retryAt: null, at: job.runAt });
    }

    await new InMemoryUnitOfWork().run(async () => {
      expect(await store.retryDead(['job-1', 'job-2'], job.runAt)).toBe(2);
      own.disconnect();
    });

    expect(lost).toEqual(['job-1', 'job-2']);
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

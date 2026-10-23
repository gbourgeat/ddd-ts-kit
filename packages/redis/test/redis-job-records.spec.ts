import { describe, expect, it } from 'vitest';
import { claimedJobOfRecord } from '../src/jobs/claimed-job-of-record';
import { parseJobRecord } from '../src/jobs/parse-job-record';
import { queuedJobOfRecord } from '../src/jobs/queued-job-of-record';
import { RedisJobStore } from '../src';
import { closeAll, connectToNothing } from './support/servers';

const actor = { id: 'user-7', type: 'user', roles: [], attributes: {} };

const record = {
  id: 'job-1',
  name: 'billing.compile-statements',
  queue: 'billing',
  payload: '{"months":[]}',
  enqueuedBy: JSON.stringify({ correlationId: 'c', actor, tenantId: 't', traceparent: '00-a-b-01' }),
  seq: 1,
  status: 'running',
  attempts: 2,
  runAt: 1_000,
  enqueuedAt: 500,
  checkpoint: '{"after":"c-1"}',
  progress: { done: 1, total: 2 },
  lastErrorCode: 'LEDGER_DOWN',
  finishedAt: 2_000,
};

describe('a record of the Redis job store', () => {
  it('is handed to the worker with its payload, who enqueued it and its checkpoint', () => {
    expect(claimedJobOfRecord(parseJobRecord(JSON.stringify(record)))).toEqual({
      id: 'job-1',
      name: 'billing.compile-statements',
      queue: 'billing',
      payload: { months: [] },
      enqueuedBy: { correlationId: 'c', actor, tenantId: 't', traceparent: '00-a-b-01' },
      enqueuedAt: new Date(500),
      attempt: 2,
      checkpoint: { after: 'c-1' },
    });
  });

  it('shows its status, progress and last failure, never its payload', () => {
    expect(queuedJobOfRecord(parseJobRecord(JSON.stringify(record)))).toEqual({
      id: 'job-1',
      name: 'billing.compile-statements',
      queue: 'billing',
      status: 'running',
      attempts: 2,
      enqueuedAt: new Date(500),
      runAt: new Date(1_000),
      progress: { done: 1, total: 2 },
      lastErrorCode: 'LEDGER_DOWN',
      finishedAt: new Date(2_000),
    });
  });

  it('is refused when it is not what the store writes', () => {
    const { enqueuedBy: _enqueuedBy, ...withoutWho } = record;

    expect(() => parseJobRecord('[]')).toThrow(TypeError);
    expect(() => parseJobRecord('null')).toThrow(TypeError);
    expect(() => parseJobRecord(JSON.stringify(withoutWho))).toThrow(TypeError);

    expect(() => claimedJobOfRecord({ ...parseJobRecord(JSON.stringify(record)), enqueuedBy: '{}' })).toThrow(
      TypeError,
    );

    expect(() => claimedJobOfRecord({ ...parseJobRecord(JSON.stringify(record)), enqueuedBy: 'null' })).toThrow(
      TypeError,
    );
  });
});

describe('RedisJobStore whose server is away', () => {
  it('rejects every call that reaches the server, and claims nothing without asking it', async () => {
    const store = new RedisJobStore(connectToNothing(), { namespace: 'billing' });
    const lease = { id: 'job-1', attempt: 1 };
    const now = new Date();

    const calls = [
      () => store.claim({ queue: 'billing', limit: 1, now, leaseMs: 1 }),
      () => store.heartbeat(lease, now),
      () => store.update(lease, { progress: { done: 1 }, checkpoint: undefined }, now),
      () => store.complete(lease, now),
      () => store.fail(lease, { errorCode: 'X', retryAt: now, at: now }),
      () => store.fail(lease, { errorCode: 'X', retryAt: null, at: now }),
      () => store.release(lease, now),
      () => store.cancel('job-1', now),
      () => store.find('job-1'),
      () => store.retryDead(['job-1'], now),
      () => store.purgeFinished(now),
      () => store.stats('billing'),
      () =>
        store.add({
          id: 'job-2',
          name: 'billing.x',
          queue: 'billing',
          payload: 1,
          enqueuedBy: { correlationId: 'c', actor: { id: 'a', type: 'user', roles: [], attributes: {} } },
          enqueuedAt: now,
          runAt: now,
          idempotencyKey: 'k',
        }),
    ];

    const outcomes = await Promise.all(
      calls.map((call) =>
        call().then(
          () => 'answered',
          () => 'rejected',
        ),
      ),
    );

    expect(outcomes).toEqual(Array.from({ length: calls.length }, () => 'rejected'));
    expect(await store.claim({ queue: 'billing', limit: 0, now, leaseMs: 1 })).toEqual([]);
    expect(await store.retryDead([], now)).toBe(0);
    await closeAll();
  });
});

import { describe, expect, it } from 'vitest';
import { executionContext, InMemoryUnitOfWork, systemActor, type Actor } from '@ddd-ts-kit/kernel';
import { InvalidEnqueueError } from '../src';
import { aQueueBench } from './support/a-queue-bench';
import { CompileStatementsJob } from './support/statements-job';

const ACCOUNTANT: Actor = { id: 'user-7', type: 'user', tenantId: 'tenant-3', roles: ['accountant'], attributes: {} };

const FEBRUARY = { month: '2026-02', customers: ['c-1'] };

describe('enqueueing a background job', () => {
  it('adds it to the queue of its context, due at once, under the correlation, the actor and the tenant of the work', async () => {
    const { queue, scope, store } = aQueueBench({ traceparent: () => '00-trace-span-01' });
    const context = executionContext({ correlationId: 'corr-1', actor: ACCOUNTANT, origin: 'http' });

    const enqueued = await scope.run(context, () => queue.enqueue(CompileStatementsJob, FEBRUARY));

    expect(enqueued).toEqual({ id: 'job-1', duplicate: false });

    expect(await queue.find('job-1')).toMatchObject({
      name: 'billing.compile-statements',
      queue: 'billing',
      status: 'waiting',
    });

    const [claimed] = await store.claim({
      queue: 'billing',
      limit: 1,
      now: new Date('2026-03-02T10:00:00.000Z'),
      leaseMs: 1,
    });

    expect(claimed?.enqueuedBy).toEqual({
      correlationId: 'corr-1',
      actor: ACCOUNTANT,
      tenantId: 'tenant-3',
      traceparent: '00-trace-span-01',
    });
  });

  it('acts as the job itself, under a correlation of its own, outside of any execution scope', async () => {
    const { queue, store, clock } = aQueueBench();

    await queue.enqueue(CompileStatementsJob, FEBRUARY);

    const [claimed] = await store.claim({ queue: 'billing', limit: 1, now: clock.now(), leaseMs: 1 });

    expect(claimed?.enqueuedBy).toEqual({ correlationId: 'job-2', actor: systemActor('billing.compile-statements') });
  });

  it('delays the job, or schedules it at an instant, never both', async () => {
    const { queue } = aQueueBench();
    const at = new Date('2026-03-03T07:00:00.000Z');

    await queue.enqueue(CompileStatementsJob, FEBRUARY, { delay: '15m' });
    await queue.enqueue(CompileStatementsJob, FEBRUARY, { runAt: at });

    expect((await queue.find('job-1'))?.runAt).toEqual(new Date('2026-03-02T10:15:00.000Z'));
    expect((await queue.find('job-3'))?.runAt).toEqual(at);

    await expect(queue.enqueue(CompileStatementsJob, FEBRUARY, { delay: 1, runAt: at })).rejects.toThrow(
      InvalidEnqueueError,
    );
  });

  it('answers the job already there for the same idempotency key', async () => {
    const { queue, store } = aQueueBench();

    await queue.enqueue(CompileStatementsJob, FEBRUARY, { idempotencyKey: 'feb' });
    const again = await queue.enqueue(CompileStatementsJob, FEBRUARY, { idempotencyKey: 'feb' });

    expect(again).toEqual({ id: 'job-1', duplicate: true });
    expect(store.list()).toHaveLength(1);
  });

  it('refuses a class whose jobName is not <context>.<job-name>', async () => {
    const { queue } = aQueueBench();

    class Unnamed extends CompileStatementsJob {
      static override readonly jobName: string = 'compile';
    }

    await expect(queue.enqueue(Unnamed, FEBRUARY)).rejects.toThrow(InvalidEnqueueError);
  });

  it('leaves no job behind a command that rolled back', async () => {
    const { queue, store } = aQueueBench();

    await expect(
      new InMemoryUnitOfWork().run(async () => {
        await queue.enqueue(CompileStatementsJob, FEBRUARY);
        throw new Error('refused');
      }),
    ).rejects.toThrow('refused');

    expect(store.list()).toEqual([]);
  });

  it('cancels a job and tells where one stands', async () => {
    const { queue } = aQueueBench();

    await queue.enqueue(CompileStatementsJob, FEBRUARY);

    expect(await queue.cancel('job-1')).toBe(true);
    expect((await queue.find('job-1'))?.status).toBe('cancelled');
    expect(await queue.cancel('job-1')).toBe(false);
  });
});

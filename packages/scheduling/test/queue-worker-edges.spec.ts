import { describe, expect, it } from 'vitest';
import { AsyncLocalStorageExecutionScope, FixedClock, executionContext } from '@ddd-ts-kit/kernel';
import { InMemoryJobStore, QueueWorker } from '../src';
import { aQueueBench } from './support/a-queue-bench';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections';
import { CompileStatementsJob, statementsPayload } from './support/statements-job';

refuseUnhandledRejections();

const FEBRUARY = { month: '2026-02', customers: ['c-1'] };

describe('an attempt whose job was cancelled while it ran', () => {
  it('is interrupted when it ends, fails or is stopped', async () => {
    const { queue, worker, timers, runs } = aQueueBench({ graceMs: 1_000, concurrency: 3 });
    const endings = ['ends', 'fails', 'is stopped'];

    worker.register({
      name: CompileStatementsJob.jobName,
      payload: statementsPayload,
      run: async (payload, execution) => {
        const ending = (payload as { month: string }).month;

        await queue.cancel(execution.jobId);

        if (ending === 'fails') {
          throw new Error('too late');
        }

        if (ending === 'is stopped') {
          await new Promise(() => undefined);
        }
      },
    });

    for (const ending of endings) {
      await queue.enqueue(CompileStatementsJob, { month: ending, customers: [] });
    }

    await worker.start();

    const stopping = worker.stop();

    await timers.advance(1_000);
    await stopping;

    expect(runs.map(({ run }) => run.outcome)).toEqual(['interrupted', 'interrupted', 'interrupted']);
  });
});

describe('what an attempt is told', () => {
  it('names the trace of the work that enqueued the job, and no tenant when that work had none', async () => {
    const { queue, worker, scope } = aQueueBench({ traceparent: () => '00-trace-span-01' });
    const seen: (string | undefined)[] = [];
    const actor = { id: 'user-7', type: 'user' as const, roles: [], attributes: {} };

    worker.register({
      name: CompileStatementsJob.jobName,
      payload: statementsPayload,
      run: async (_payload, execution) => void seen.push(execution.traceparent),
    });

    await scope.run(executionContext({ correlationId: 'c', actor, origin: 'http' }), () =>
      queue.enqueue(CompileStatementsJob, FEBRUARY),
    );

    await worker.runDue();

    expect(seen).toEqual(['00-trace-span-01']);
  });
});

describe('a worker left to its defaults', () => {
  it('runs on the timers of the runtime, one attempt per queue at a time, and records to no one', async () => {
    const store = new InMemoryJobStore();

    const worker = new QueueWorker({
      store,
      clock: new FixedClock(new Date()),
      scope: new AsyncLocalStorageExecutionScope(),
      concurrency: { audit: 3 },
    });

    worker.register(new CompileStatementsJob().definition());
    await worker.start();
    await worker.stop();

    expect(await worker.runDue()).toEqual([]);
  });

  it('does not sleep again when a claim fails after it stopped', async () => {
    const { worker, store, timers, logger } = aQueueBench();
    let unstall: () => void = () => undefined;

    store.stalledClaim = new Promise((resolve) => {
      unstall = resolve;
    });

    worker.register(new CompileStatementsJob().definition());

    const starting = worker.start();
    const stopping = worker.stop();

    unstall();
    await Promise.all([starting, stopping]);

    expect(timers.pending).toBe(0);
    expect(logger.entries).toMatchObject([{ fields: { queue: 'billing', errorType: 'string' } }]);
  });

  it('waits for a claim in flight when it stops, and gives back what it brought, uncounted', async () => {
    const { queue, worker, store } = aQueueBench();
    const job = new CompileStatementsJob();
    let open: () => void = () => undefined;

    store.heldClaim = new Promise((resolve) => {
      open = resolve;
    });

    worker.register(job.definition());
    await queue.enqueue(CompileStatementsJob, FEBRUARY);

    const starting = worker.start();
    let stopped = false;

    const stopping = worker.stop().then(() => {
      stopped = true;
    });

    await Promise.resolve();
    expect(stopped).toBe(false);

    open();
    await Promise.all([starting, stopping]);

    const kept = await queue.find('job-1');

    expect([job.runs.length, kept?.status, kept?.attempts]).toEqual([0, 'waiting', 0]);
  });
});

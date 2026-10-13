import { describe, expect, it } from 'vitest';
import { AsyncLocalStorageExecutionScope, FixedClock, executionContext } from '@ddd-ts-kit/kernel';
import { InMemoryJobStore, QueueWorker } from '../src/index.js';
import { aQueueBench } from './support/a-queue-bench.js';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections.js';
import { CompileStatementsJob } from './support/statements-job.js';

refuseUnhandledRejections();

const FEBRUARY = { month: '2026-02', customers: ['c-1'] };

describe('an attempt whose job was cancelled while it ran', () => {
  it('is interrupted when it ends, fails or is stopped', async () => {
    const { queue, worker, timers, runs } = aQueueBench({ graceMs: 1_000, concurrency: 3 });
    const endings = ['ends', 'fails', 'is stopped'];

    worker.register({
      name: CompileStatementsJob.jobName,
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

    await worker.stop();
    unstall();
    await starting;

    expect(timers.pending).toBe(0);
    expect(logger.entries).toMatchObject([{ fields: { queue: 'billing', errorType: 'string' } }]);
  });
});

import { describe, expect, it } from 'vitest';
import { InMemoryErrorReporter, InMemoryLogger, InMemoryUnitOfWork, NotFoundError } from '@ddd-ts-kit/kernel';
import { reportFailedBackgroundJobs, type BackgroundJobRun } from '../src/index.js';
import { aQueueBench } from './support/a-queue-bench.js';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections.js';
import { CompileStatementsJob } from './support/statements-job.js';

refuseUnhandledRejections();

const FEBRUARY = { month: '2026-02', customers: ['c-1'] };

describe('a worker whose store stumbles', () => {
  it('logs a claim that failed, then asks again at the next poll', async () => {
    const { queue, worker, timers, store, logger } = aQueueBench({ pollIntervalMs: 1_000 });
    const job = new CompileStatementsJob();

    worker.register(job.definition());
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    store.failingClaims = 1;
    await worker.start();

    expect(logger.entries).toMatchObject([
      {
        level: 'error',
        message: 'Background jobs could not be followed',
        fields: { queue: 'billing', errorCode: 'STORE_DOWN' },
      },
    ]);

    await timers.advance(1_000);
    expect(job.runs).toHaveLength(1);
    await worker.stop();
  });

  it('goes on through a heartbeat the store could not take', async () => {
    const { queue, worker, timers, store, runs } = aQueueBench();
    const job = new CompileStatementsJob();

    worker.register(job.definition({ lease: '30s' }));
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    store.failingHeartbeats = 1;
    job.hold();
    await worker.start();
    await timers.advance(20_000);
    job.release();
    await timers.advance(0);
    await worker.stop();

    expect(runs.map(({ run }) => run.outcome)).toEqual(['succeeded']);
  });

  it('records as interrupted an attempt the store could not be told of: its lease brings the job back', async () => {
    const { queue, worker, store, runs } = aQueueBench();
    const job = new CompileStatementsJob();

    worker.register(job.definition());
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    store.failingWrites = 1;
    await worker.runDue();

    expect(runs.map(({ run }) => [run.outcome, run.errorCode])).toEqual([['interrupted', 'STORE_DOWN']]);
    expect((await queue.find('job-1'))?.status).toBe('running');
  });

  it('records as interrupted a job it could not refuse', async () => {
    const { queue, worker, store, runs } = aQueueBench();

    worker.register({ name: 'billing.send-statements', run: () => Promise.resolve() });
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    store.failingWrites = 1;
    await worker.runDue();

    expect(runs.map(({ run }) => run.outcome)).toEqual(['interrupted']);
  });

  it('stops an attempt whose checkpoint the store refuses: another worker took the job over', async () => {
    const { queue, worker, store, clock, runs } = aQueueBench();

    worker.register({
      name: CompileStatementsJob.jobName,
      options: { lease: '1m' },
      run: async (_payload, execution) => {
        clock.advance(60_000);
        await store.claim({ queue: 'billing', limit: 1, now: clock.now(), leaseMs: 60_000 });
        await execution.saveCheckpoint({ after: 'c-1' });
      },
    });

    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    await worker.runDue();

    expect(runs.map(({ run }) => [run.outcome, run.errorCode])).toEqual([['interrupted', 'JOB_INTERRUPTED']]);
  });
});

describe('the tuning of a worker', () => {
  it('runs as many attempts of a queue at once as its number, or the default one', async () => {
    const counts: number[] = [];

    for (const concurrency of [3, { default: 2 }, { billing: 1, default: 4 }]) {
      const { queue, worker } = aQueueBench({ concurrency });
      const job = new CompileStatementsJob();

      worker.register(job.definition());

      for (const month of ['1', '2', '3', '4']) {
        await queue.enqueue(CompileStatementsJob, { month, customers: [] });
      }

      job.hold();
      await worker.start();
      counts.push(job.runs.length);
      job.release();
      await worker.stop();
    }

    expect(counts).toEqual([3, 2, 1]);
  });

  it('starts once, and stops at once when it never started', async () => {
    const { worker } = aQueueBench();

    worker.register(new CompileStatementsJob().definition());
    await worker.stop();
    await worker.start();
    await worker.start();
    await worker.stop();

    expect(worker.queueNames()).toEqual(['billing']);
  });

  it('refuses a job registered twice', () => {
    const { worker } = aQueueBench();

    worker.register(new CompileStatementsJob().definition());

    expect(() => worker.register(new CompileStatementsJob().definition())).toThrow(/already registered/);
  });
});

describe('what a worker records', () => {
  it('logs nothing below the level of the logger, and names what a run threw', async () => {
    const logger = new InMemoryLogger({ level: 'error' });
    const { queue, worker } = aQueueBench({ logger });
    const job = new CompileStatementsJob();

    job.failures = [Object.assign(new Error('odd'), { code: 42 })];
    worker.register(job.definition({ maxAttempts: 1 }));
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    await queue.enqueue(CompileStatementsJob, { month: '2026-03', customers: [] });
    await worker.runDue();

    expect(logger.entries).toMatchObject([
      {
        level: 'error',
        message: 'Background job failed for good: it is dead',
        fields: { errorType: 'Error', errorCode: 'UNEXPECTED_ERROR' },
      },
    ]);
  });

  it('reports neither a refusal of the domain nor an attempt that did not fail', () => {
    const reporter = new InMemoryErrorReporter();
    const report = reportFailedBackgroundJobs(reporter);

    const run: BackgroundJobRun = {
      job: 'billing.compile-statements',
      jobId: 'job-1',
      attempt: 1,
      outcome: 'retried',
      startedAt: new Date(),
      durationMs: 1,
      correlationId: 'corr-1',
    };

    report(run, new NotFoundError('invoice'));
    report({ ...run, outcome: 'released' }, new Error('stopped'));

    expect(reporter.reports).toEqual([]);
  });
});

describe('jobs enqueued at the same instant', () => {
  it('keeps one job of a key enqueued by two commands committing together', async () => {
    const { queue, store } = aQueueBench();

    const enqueue = () =>
      new InMemoryUnitOfWork().run(() => queue.enqueue(CompileStatementsJob, FEBRUARY, { idempotencyKey: 'feb' }));

    await Promise.all([enqueue(), enqueue()]);

    expect(store.list()).toHaveLength(1);
  });

  it('runs every job of a queue that several jobs share, and forgets a checkpoint set back to nothing', async () => {
    const { queue, worker, clock } = aQueueBench();
    const job = new CompileStatementsJob();
    const checkpoints: unknown[] = [];

    worker.register(job.definition());

    worker.register({
      name: 'billing.send-statements',
      run: async (_payload, execution) => {
        checkpoints.push(execution.checkpoint);
        await execution.saveCheckpoint(checkpoints.length === 1 ? 'half' : undefined);
        throw new Error('again');
      },
    });

    class SendStatementsJob extends CompileStatementsJob {
      static override readonly jobName: string = 'billing.send-statements';
    }

    await queue.enqueue(SendStatementsJob, FEBRUARY);
    await queue.enqueue(CompileStatementsJob, FEBRUARY);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await worker.runDue();
      clock.advance(300_000);
    }

    expect(job.runs).toHaveLength(1);
    expect(checkpoints).toEqual([undefined, 'half', undefined]);
  });
});

describe('a worker whose logger fails', () => {
  it('still settles every attempt', async () => {
    class BrokenLogger extends InMemoryLogger {
      override info(): void {
        throw new Error('disk full');
      }
    }

    const { queue, worker, runs } = aQueueBench({ logger: new BrokenLogger() });

    worker.register(new CompileStatementsJob().definition());
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    await worker.runDue();

    expect(runs.map(({ run }) => run.outcome)).toEqual(['succeeded']);
    expect((await queue.find('job-1'))?.status).toBe('succeeded');
  });
});

import { describe, expect, it } from 'vitest';
import { InMemoryErrorReporter } from '@ddd-ts-kit/kernel';
import {
  BACKGROUND_RUNS_COUNTER,
  JobAbortedError,
  JobInterruptedError,
  JobTimeoutError,
  reportFailedBackgroundJobs,
} from '../src/index.js';
import { aQueueBench } from './support/a-queue-bench.js';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections.js';
import { CompileStatementsJob } from './support/statements-job.js';

refuseUnhandledRejections();

const FEBRUARY = { month: '2026-02', customers: ['c-1'] };

describe('a started worker', () => {
  it('claims what is due, then asks the store again at each poll', async () => {
    const { queue, worker, timers } = aQueueBench({ pollIntervalMs: 5_000 });
    const job = new CompileStatementsJob();

    worker.register(job.definition());
    await worker.start();
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    await timers.advance(4_999);
    expect(job.runs).toHaveLength(0);

    await timers.advance(1);
    expect(job.runs).toHaveLength(1);
    await worker.stop();
  });

  it('runs no more attempts of a queue at once than its concurrency', async () => {
    const { queue, worker, timers } = aQueueBench({ concurrency: { billing: 2 } });
    const job = new CompileStatementsJob();

    worker.register(job.definition());

    for (const month of ['2026-01', '2026-02', '2026-03']) {
      await queue.enqueue(CompileStatementsJob, { month, customers: [] });
    }

    job.hold();
    await worker.start();
    expect(job.runs.map((run) => run.payload.month)).toEqual(['2026-01', '2026-02']);

    job.release();
    await timers.advance(0);
    expect(job.runs.map((run) => run.payload.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    await worker.stop();
  });

  it('aborts an attempt past its timeout and counts it as failed', async () => {
    const { queue, worker, timers, runs } = aQueueBench();
    const job = new CompileStatementsJob();

    worker.register(job.definition({ timeout: '1m' }));
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    job.hold();
    await worker.start();
    await timers.advance(60_000);

    expect(job.runs[0]?.execution.signal.reason).toBeInstanceOf(JobTimeoutError);
    expect(runs.map(({ run }) => run)).toMatchObject([{ outcome: 'retried', errorCode: 'JOB_TIMEOUT' }]);
    job.release();
    await worker.stop();
  });

  it('extends the lease while the attempt runs, and stops it at the heartbeat after a cancellation', async () => {
    const { queue, worker, timers, store, clock, runs } = aQueueBench();
    const job = new CompileStatementsJob();

    worker.register(job.definition({ lease: '30s' }));
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    job.hold();
    await worker.start();
    await timers.advance(60_000);

    expect(await store.claim({ queue: 'billing', limit: 1, now: clock.now(), leaseMs: 1 })).toEqual([]);

    await queue.cancel('job-1');
    await timers.advance(10_000);

    expect(job.runs[0]?.execution.signal.reason).toBeInstanceOf(JobInterruptedError);
    expect(runs.map(({ run }) => run.outcome)).toEqual(['interrupted']);
    expect((await queue.find('job-1'))?.status).toBe('cancelled');
    job.release();
    await worker.stop();
  });

  it('waits for the attempt in progress when it stops, then gives the job back past the grace period', async () => {
    const { queue, worker, timers, runs } = aQueueBench({ graceMs: 20_000 });
    const job = new CompileStatementsJob();

    worker.register(job.definition());
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    job.hold();
    await worker.start();

    const stopping = worker.stop();

    await timers.advance(19_999);
    expect(job.runs[0]?.execution.signal.aborted).toBe(false);
    await timers.advance(1);
    await stopping;

    expect(job.runs[0]?.execution.signal.reason).toBeInstanceOf(JobAbortedError);
    expect(runs.map(({ run }) => run.outcome)).toEqual(['released']);
    expect(await queue.find('job-1')).toMatchObject({ status: 'waiting', attempts: 0 });
    expect(timers.pending).toBe(0);
    job.release();
  });

  it('counts each attempt by job, context and outcome, and reports an unexpected failure', async () => {
    const { queue, worker, metrics, runs } = aQueueBench();
    const job = new CompileStatementsJob();
    const reporter = new InMemoryErrorReporter();
    const report = reportFailedBackgroundJobs(reporter);

    job.failures = [new Error('disk full')];
    worker.register(job.definition());
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    await worker.runDue();

    for (const { run, error } of runs) {
      report(run, error);
    }

    expect(
      metrics.counterValue(BACKGROUND_RUNS_COUNTER, {
        job: 'billing.compile-statements',
        context: 'billing',
        status: 'retried',
        error_code: 'UNEXPECTED_ERROR',
      }),
    ).toBe(1);

    expect(reporter.reports).toMatchObject([
      { report: { origin: 'queue', operation: 'billing.compile-statements', context: 'billing' } },
    ]);
  });
});

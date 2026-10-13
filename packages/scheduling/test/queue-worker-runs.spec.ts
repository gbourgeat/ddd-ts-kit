import { describe, expect, it } from 'vitest';
import { executionContext, type Actor, type ExecutionContext } from '@ddd-ts-kit/kernel';
import { AttemptsExhaustedError, UnknownBackgroundJobError } from '../src/index.js';
import { aQueueBench } from './support/a-queue-bench.js';
import { CompileStatementsJob } from './support/statements-job.js';

const ACCOUNTANT: Actor = { id: 'user-7', type: 'user', tenantId: 'tenant-3', roles: [], attributes: {} };

const FEBRUARY = { month: '2026-02', customers: ['c-1', 'c-2'] };

class LedgerDown extends Error {
  readonly code = 'LEDGER_DOWN';
}

describe('a worker running due jobs', () => {
  it('runs the job with its payload, as the actor that enqueued it, in the correlation of that work', async () => {
    const { queue, worker, scope } = aQueueBench();
    const job = new CompileStatementsJob();
    const seen: (ExecutionContext | undefined)[] = [];

    worker.register({
      ...job.definition(),
      run: async (payload, execution) => {
        seen.push(scope.current());
        await job.run(payload as typeof FEBRUARY, execution);
      },
    });

    await scope.run(executionContext({ correlationId: 'corr-1', actor: ACCOUNTANT, origin: 'http' }), () =>
      queue.enqueue(CompileStatementsJob, FEBRUARY),
    );

    const runs = await worker.runDue();

    expect(job.runs.map((run) => run.payload)).toEqual([FEBRUARY]);
    expect(job.runs[0]?.execution).toMatchObject({ jobId: 'job-1', attempt: 1, checkpoint: undefined });

    expect(seen[0]).toMatchObject({
      origin: 'queue',
      correlationId: 'corr-1',
      causationId: 'job-1',
      actor: ACCOUNTANT,
      tenantId: 'tenant-3',
    });

    expect(runs).toMatchObject([
      { job: 'billing.compile-statements', outcome: 'succeeded', attempt: 1, correlationId: 'corr-1' },
    ]);

    expect((await queue.find('job-1'))?.status).toBe('succeeded');
  });

  it('tries a failed job again after the backoff, then declares it dead', async () => {
    const { queue, worker, clock } = aQueueBench();
    const job = new CompileStatementsJob();

    job.failures = [new LedgerDown(), new LedgerDown()];
    worker.register(job.definition({ maxAttempts: 2, backoff: { baseMs: 1_000 } }));
    await queue.enqueue(CompileStatementsJob, FEBRUARY);

    expect(await worker.runDue()).toMatchObject([{ outcome: 'retried', errorCode: 'LEDGER_DOWN' }]);
    expect(await worker.runDue()).toEqual([]);

    clock.advance(1_000);

    expect(await worker.runDue()).toMatchObject([{ outcome: 'dead', attempt: 2, errorCode: 'LEDGER_DOWN' }]);
    expect(await queue.find('job-1')).toMatchObject({ status: 'dead', attempts: 2, lastErrorCode: 'LEDGER_DOWN' });
  });

  it('hands the next attempt the checkpoint the last one saved, and shows the progress', async () => {
    const { queue, worker, clock } = aQueueBench();
    const job = new CompileStatementsJob();

    worker.register({
      name: CompileStatementsJob.jobName,
      run: async (_payload, execution) => {
        job.runs.push({ payload: FEBRUARY, execution });

        if (execution.checkpoint === undefined) {
          await execution.reportProgress({ done: 1, total: 2 });
          await execution.saveCheckpoint({ after: 'c-1' });
          throw new LedgerDown();
        }
      },
    });

    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    await worker.runDue();
    expect((await queue.find('job-1'))?.progress).toEqual({ done: 1, total: 2 });

    clock.advance(1_000);
    await worker.runDue();

    expect(job.runs.map((run) => run.execution.checkpoint)).toEqual([undefined, { after: 'c-1' }]);
    expect((await queue.find('job-1'))?.status).toBe('succeeded');
  });

  it('gives back a job no module registered, and lets it die after the default attempts', async () => {
    const { queue, worker, clock, runs } = aQueueBench();

    worker.register({ name: 'billing.send-statements', run: () => Promise.resolve() });
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    await worker.runDue();

    expect(runs[0]?.error).toBeInstanceOf(UnknownBackgroundJobError);
    expect(runs[0]?.run).toMatchObject({ outcome: 'retried', errorCode: 'UNKNOWN_BACKGROUND_JOB' });

    for (let attempt = 2; attempt <= 5; attempt += 1) {
      clock.advance(300_000);
      await worker.runDue();
    }

    expect((await queue.find('job-1'))?.status).toBe('dead');
  });

  it('declares dead a job claimed again after its last attempt, whose worker died', async () => {
    const { queue, worker, store, clock, runs } = aQueueBench();
    const job = new CompileStatementsJob();

    worker.register(job.definition({ maxAttempts: 1, lease: '1m' }));
    await queue.enqueue(CompileStatementsJob, FEBRUARY);
    await store.claim({ queue: 'billing', limit: 1, now: clock.now(), leaseMs: 60_000 });
    clock.advance(60_000);

    await worker.runDue();

    expect(job.runs).toEqual([]);
    expect(runs[0]?.error).toBeInstanceOf(AttemptsExhaustedError);
    expect((await queue.find('job-1'))?.status).toBe('dead');
  });
});

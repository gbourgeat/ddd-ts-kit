import { describe, expect, it } from 'vitest';
import {
  InMemoryErrorReporter,
  err,
  ok,
  type BackgroundJob,
  type BackgroundJobPayloadSchema,
} from '@ddd-ts-kit/kernel';
import { InvalidEnqueuedPayloadError, InvalidJobPayloadError, QueueWorker, reportFailedBackgroundJobs } from '../src';
import { aQueueBench } from './support/a-queue-bench';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections';
import { CompileStatementsJob, statementsPayload } from './support/statements-job';

refuseUnhandledRejections();

/** The payload of the job before the deploy that added the customers to it. */
interface MonthOnly {
  readonly month: string;
}

/** The same job, as the version deployed before it enqueued it: one month, no customers. */
class CompileStatementsJobBeforeTheDeploy implements BackgroundJob<MonthOnly> {
  static readonly jobName = CompileStatementsJob.jobName;

  static readonly payload = { parse: (input: unknown) => ok(Object(input) as MonthOnly) };

  async run(): Promise<void> {
    return undefined;
  }
}

describe('a worker reading the stored payload with the schema of its job', () => {
  it('never runs a payload enqueued in the shape of an earlier version: the job is dead at once, with the reason', async () => {
    const { queue, worker, runs } = aQueueBench();
    const job = new CompileStatementsJob();

    worker.register(job.definition({ maxAttempts: 5 }));
    await queue.enqueue(CompileStatementsJobBeforeTheDeploy, { month: '2026-02' });

    expect(await worker.runDue()).toMatchObject([
      {
        job: 'billing.compile-statements',
        jobId: 'job-1',
        attempt: 1,
        outcome: 'dead',
        errorCode: 'INVALID_JOB_PAYLOAD',
      },
    ]);

    expect(job.runs).toEqual([]);
    expect(runs[0]?.error).toBeInstanceOf(InvalidJobPayloadError);

    expect(runs[0]?.error).toMatchObject({
      job: 'billing.compile-statements',
      jobId: 'job-1',
      issues: [{ path: 'customers', code: 'invalid_type' }],
      message:
        'Background job "billing.compile-statements" (job job-1) was not run: its stored payload does not fit its schema (customers: invalid_type).',
    });

    expect(await queue.find('job-1')).toMatchObject({
      status: 'dead',
      attempts: 1,
      lastErrorCode: 'INVALID_JOB_PAYLOAD',
    });
  });

  it('logs the refusal by its code, never the stored payload nor the message of an issue', async () => {
    const { queue, worker, logger } = aQueueBench();

    worker.register(new CompileStatementsJob().definition());
    await queue.enqueue(CompileStatementsJobBeforeTheDeploy, { month: 'ACME-2026-02' });
    await worker.runDue();

    expect(logger.entries).toMatchObject([
      { level: 'error', fields: { errorCode: 'INVALID_JOB_PAYLOAD', errorType: 'InvalidJobPayloadError' } },
    ]);

    expect(JSON.stringify(logger.entries)).not.toMatch(/ACME|customer ids/);
  });

  it('hands the run the payload as the schema reads it, not as it was stored', async () => {
    const { queue, worker } = aQueueBench();
    const job = new CompileStatementsJob();
    const stored = { month: '2026-02', customers: ['c-1'], region: 'north' };

    worker.register(job.definition());
    await queue.enqueue(CompileStatementsJob, stored);
    await worker.runDue();

    expect(job.runs.map((run) => run.payload)).toEqual([{ month: '2026-02', customers: ['c-1'] }]);
  });

  it('tries again a job whose schema throws, as it would a fault of the run', async () => {
    const { queue, worker } = aQueueBench();

    worker.register({
      name: CompileStatementsJob.jobName,
      payload: { parse: failing },
      run: () => Promise.resolve(),
    });

    await queue.enqueue(CompileStatementsJob, { month: '2026-02', customers: [] });

    expect(await worker.runDue()).toMatchObject([{ outcome: 'retried', errorCode: 'UNEXPECTED_ERROR' }]);
  });
});

describe('a refusal of the stored payload, as the error reporter receives it', () => {
  it('holds the path and the code of each issue, never a stored value nor the message that quotes it', async () => {
    const { queue, store, clock, scope } = aQueueBench();
    const errors = new InMemoryErrorReporter();
    const worker = new QueueWorker({ store, clock, scope, onRun: reportFailedBackgroundJobs(errors) });

    worker.register({ name: CompileStatementsJob.jobName, payload: quoting, run: () => Promise.resolve() });
    await queue.enqueue(CompileStatementsJobBeforeTheDeploy, { month: 'ACME-2026-02' });
    await worker.runDue();

    const [reported] = errors.reports;

    expect(reported?.error).toMatchObject({
      code: 'INVALID_JOB_PAYLOAD',
      issues: [{ path: 'month', code: 'invalid_string' }],
    });

    expect([JSON.stringify(reported), String(Object(reported?.error).message)].join(' ')).not.toContain('ACME');
  });
});

describe('a queue enqueueing a background job', () => {
  it('refuses a payload the schema of the job refuses, by path and code, and stores nothing', async () => {
    const { queue, store } = aQueueBench();

    await expect(queue.enqueue(MonthlyStatementsJob, { month: '2026-02' })).rejects.toMatchObject({
      code: 'INVALID_ENQUEUED_PAYLOAD',
      job: 'billing.compile-statements',
      issues: [{ path: 'customers', code: 'invalid_type' }],
    });

    await expect(queue.enqueue(MonthlyStatementsJob, { month: '2026-02' })).rejects.toBeInstanceOf(
      InvalidEnqueuedPayloadError,
    );

    expect(store.list()).toEqual([]);
  });
});

/** A job whose type forgot the customers its schema requires: what `enqueue` reads is the schema. */
class MonthlyStatementsJob implements BackgroundJob<MonthOnly> {
  static readonly jobName = CompileStatementsJob.jobName;

  static readonly payload: BackgroundJobPayloadSchema<MonthOnly> = { parse: (input) => statementsPayload.parse(input) };

  async run(): Promise<void> {
    return undefined;
  }
}

/** A schema whose message quotes the value it refuses, as a library may. */
const quoting: BackgroundJobPayloadSchema<unknown> = {
  parse: (input) =>
    err([{ path: 'month', code: 'invalid_string', message: `"${String(Object(input).month)}" is not a month.` }]),
};

function failing(): never {
  throw new Error('The schema itself failed.');
}

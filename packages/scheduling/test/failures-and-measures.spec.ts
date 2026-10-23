import { describe, expect, it } from 'vitest';
import { InMemoryLogger } from '@ddd-ts-kit/kernel';
import { DURATION_HISTOGRAM, RUNS_COUNTER } from '../src';
import { aBench } from './support/a-bench';
import { MINUTE } from './support/durations';
import { EXPORT, REMINDERS } from './support/job-names';
import { LedgerClosed } from './support/ledger-closed';
import { QUARTERLY } from './support/quarterly';
import { RecordingJob } from './support/recording-job';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections';

refuseUnhandledRejections();

describe('a job that fails', () => {
  it('is recorded with the code of its error, never its message, and stops neither the scheduler nor the other jobs', async () => {
    const { scheduler, logger, metrics } = aBench();
    const failure = new LedgerClosed('The ledger of ACME Corp is closed');
    const reminders = new RecordingJob();

    scheduler.register({ name: EXPORT, schedule: QUARTERLY, run: () => Promise.reject(failure) });
    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: reminders.run });
    await scheduler.start();

    await scheduler.advance(17 * MINUTE);

    expect(scheduler.runsOf(EXPORT)).toMatchObject([
      { outcome: 'failed', errorCode: 'LEDGER_CLOSED', durationMs: 0 },
      { outcome: 'failed', errorCode: 'LEDGER_CLOSED' },
    ]);

    expect(scheduler.failures).toEqual([failure, failure]);
    expect(reminders.executions).toHaveLength(2);

    expect(logger.entries.filter((entry) => entry.level === 'error')).toMatchObject([
      {
        message: 'Scheduled job failed',
        fields: {
          job: EXPORT,
          context: 'billing',
          outcome: 'failed',
          errorCode: 'LEDGER_CLOSED',
          errorType: 'LedgerClosed',
          correlationId: 'run-1',
        },
      },
      { message: 'Scheduled job failed' },
    ]);

    expect(JSON.stringify([logger.entries, metrics.samples, scheduler.runs])).not.toContain('ACME');
    expect(metrics.counterValue(RUNS_COUNTER, { job: EXPORT, status: 'failed', error_code: 'LEDGER_CLOSED' })).toBe(2);
  });

  it('is recorded as an unexpected error when what it threw carries no code', async () => {
    const { scheduler } = aBench();

    scheduler.register({
      name: EXPORT,
      schedule: QUARTERLY,
      run: () => {
        throw new TypeError('x is not a function');
      },
    });

    expect(await scheduler.runNow(EXPORT)).toMatchObject({ outcome: 'failed', errorCode: 'UNEXPECTED_ERROR' });
  });

  it('writes nothing about a run below the level of its logger, and still measures it', async () => {
    const logger = new InMemoryLogger({ level: 'error' });
    const { scheduler, metrics } = aBench({ logger });

    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: new RecordingJob().run });
    scheduler.register({ name: EXPORT, schedule: QUARTERLY, run: () => Promise.reject(new LedgerClosed('closed')) });
    await scheduler.start();

    await scheduler.advance(2 * MINUTE);

    expect(logger.entries.map((entry) => entry.message)).toEqual(['Scheduled job failed']);
    expect(metrics.counterValue(RUNS_COUNTER, { job: REMINDERS, status: 'succeeded' })).toBe(1);
  });

  it('is still run and answered when the logger and the metrics themselves throw', async () => {
    const broken = (): never => {
      throw new Error('collector down');
    };

    const { scheduler } = aBench({
      logger: {
        debug: broken,
        info: broken,
        warn: broken,
        error: broken,
        child: broken,
        isLevelEnabled: broken,
        flush: broken,
      },
      metrics: { counter: broken, histogram: broken, gauge: broken },
    });

    const job = new RecordingJob();

    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: job.run });
    scheduler.register({ name: EXPORT, schedule: QUARTERLY, run: () => Promise.reject(new LedgerClosed('closed')) });
    await scheduler.start();

    await scheduler.advance(17 * MINUTE);

    expect(job.executions).toHaveLength(2);
    expect(scheduler.runsOf(EXPORT)).toMatchObject([{ outcome: 'failed' }, { outcome: 'failed' }]);
  });

  it('does not take the scheduler with it when the observer of the runs throws too', async () => {
    const { scheduler } = aBench({
      onRun: () => {
        throw new Error('tracker down');
      },
    });

    const job = new RecordingJob();

    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: job.run });
    await scheduler.start();

    await scheduler.advance(17 * MINUTE);

    expect(job.executions).toHaveLength(2);
  });
});

describe('what a scheduler measures', () => {
  it('counts every occurrence by job and outcome, and times the runs', async () => {
    const { scheduler, clock, logger, metrics } = aBench();

    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: async () => clock.advance(1_200) });
    await scheduler.start();

    await scheduler.advance(2 * MINUTE);

    expect(metrics.counterValue(RUNS_COUNTER, { job: REMINDERS, context: 'billing', status: 'succeeded' })).toBe(1);
    expect(metrics.histogramValues(DURATION_HISTOGRAM, { job: REMINDERS, status: 'succeeded' })).toEqual([1_200]);

    expect(logger.entries).toEqual([
      {
        level: 'info',
        message: 'Scheduled job succeeded',
        fields: {
          job: REMINDERS,
          context: 'billing',
          outcome: 'succeeded',
          scheduledAt: new Date('2026-03-02T10:00:00.000Z'),
          durationMs: 1_200,
          correlationId: 'run-1',
        },
      },
    ]);
  });
});

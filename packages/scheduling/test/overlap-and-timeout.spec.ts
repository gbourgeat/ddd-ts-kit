import { describe, expect, it } from 'vitest';
import { JobTimeoutError } from '../src';
import { aBench } from './support/a-bench';
import { MINUTE } from './support/durations';
import { EXPORT } from './support/job-names';
import { QUARTERLY } from './support/quarterly';
import { RecordingJob } from './support/recording-job';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections';

refuseUnhandledRejections();

describe('an occurrence that comes while the previous run is in progress', () => {
  it('is skipped by default, and the job runs again once it is free', async () => {
    const { scheduler } = aBench();
    const job = new RecordingJob();

    scheduler.register({ name: EXPORT, schedule: QUARTERLY, run: job.run });
    await scheduler.start();
    job.gate();

    await scheduler.advance(32 * MINUTE);
    expect(job.scheduledAt).toEqual(['2026-03-02T10:00:00.000Z']);

    expect(scheduler.runs).toMatchObject([
      { outcome: 'skipped-overlap', scheduledAt: new Date('2026-03-02T10:15:00.000Z') },
      { outcome: 'skipped-overlap', scheduledAt: new Date('2026-03-02T10:30:00.000Z') },
    ]);

    job.open();
    await scheduler.advance(15 * MINUTE);
    expect(job.scheduledAt).toEqual(['2026-03-02T10:00:00.000Z', '2026-03-02T10:45:00.000Z']);
  });

  it('waits its turn under overlap queue, one occurrence at most', async () => {
    const { scheduler } = aBench();
    const job = new RecordingJob();

    scheduler.register({ name: EXPORT, schedule: QUARTERLY, overlap: 'queue', run: job.run });
    await scheduler.start();
    job.gate();

    await scheduler.advance(32 * MINUTE);

    expect(scheduler.runs).toMatchObject([
      { outcome: 'skipped-overlap', scheduledAt: new Date('2026-03-02T10:30:00.000Z') },
    ]);

    job.open();
    await scheduler.advance(MINUTE);

    expect(job.executions).toMatchObject([
      { scheduledAt: new Date('2026-03-02T10:00:00.000Z') },
      { scheduledAt: new Date('2026-03-02T10:15:00.000Z'), startedAt: new Date('2026-03-02T10:30:30.000Z') },
    ]);
  });
});

describe('a run that lasts too long', () => {
  it('is aborted through its signal after timeoutMs, recorded as failed, and leaves the job free for its next occurrence', async () => {
    const { scheduler } = aBench();
    const job = new RecordingJob();

    scheduler.register({ name: EXPORT, schedule: QUARTERLY, timeoutMs: 5 * MINUTE, run: job.run });
    await scheduler.start();
    job.gate();

    await scheduler.advance(6 * MINUTE);
    const [execution] = job.executions;

    expect(execution?.signal.aborted).toBe(false);

    await scheduler.advance(MINUTE);
    expect(execution?.signal.aborted).toBe(true);
    expect(execution?.signal.reason).toBeInstanceOf(JobTimeoutError);
    expect(scheduler.runs).toMatchObject([{ outcome: 'failed', errorCode: 'JOB_TIMEOUT', durationMs: 5 * MINUTE }]);

    await scheduler.advance(10 * MINUTE);
    expect(job.scheduledAt).toEqual(['2026-03-02T10:00:00.000Z', '2026-03-02T10:15:00.000Z']);
    job.open();
  });
});

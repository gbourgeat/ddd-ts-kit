import { describe, expect, it } from 'vitest';
import { JobAbortedError } from '../src';
import { aBench } from './support/a-bench';
import { HOUR, MINUTE } from './support/durations';
import { EXPORT, REMINDERS } from './support/job-names';
import { QUARTERLY } from './support/quarterly';
import { RecordingJob } from './support/recording-job';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections';

refuseUnhandledRejections();

describe('stopping', () => {
  it('waits for the run in progress, and starts nothing more', async () => {
    const { scheduler } = aBench();
    const job = new RecordingJob();

    scheduler.register({ name: EXPORT, schedule: QUARTERLY, run: job.run });
    await scheduler.start();
    job.gate();
    await scheduler.advance(2 * MINUTE);

    let stopped = false;
    const stopping = scheduler.stop().then(() => (stopped = true));

    await scheduler.advance(10_000);
    expect(stopped).toBe(false);

    job.open();
    await stopping;
    await scheduler.advance(HOUR);
    expect(job.executions).toHaveLength(1);
    expect(job.executions[0]?.signal.aborted).toBe(false);
    expect(scheduler.runs).toMatchObject([{ outcome: 'succeeded' }]);
  });

  it('aborts through the signal a run that outlives the grace period, and drops the one that waited behind it', async () => {
    const { scheduler } = aBench({ graceMs: 20_000 });
    const job = new RecordingJob();

    scheduler.register({ name: EXPORT, schedule: QUARTERLY, overlap: 'queue', run: job.run });
    await scheduler.start();
    job.gate();
    await scheduler.advance(17 * MINUTE);

    const stopping = scheduler.stop();

    await scheduler.advance(19_000);
    expect(job.executions[0]?.signal.aborted).toBe(false);
    await scheduler.advance(1_000);
    await stopping;

    expect(job.executions).toHaveLength(1);
    expect(job.executions[0]?.signal.reason).toBeInstanceOf(JobAbortedError);

    expect(scheduler.runs).toMatchObject([
      { outcome: 'failed', errorCode: 'JOB_ABORTED', scheduledAt: new Date('2026-03-02T10:00:00.000Z') },
      { outcome: 'missed', scheduledAt: new Date('2026-03-02T10:15:00.000Z') },
    ]);

    expect(scheduler.timers.pending).toBe(0);
  });

  it('can be followed by a new start, which takes the jobs up from that instant', async () => {
    const { scheduler } = aBench();
    const job = new RecordingJob();

    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: job.run });
    await scheduler.start();
    await scheduler.stop();
    await scheduler.advance(HOUR);
    expect(job.executions).toEqual([]);

    await scheduler.start();
    await scheduler.advance(2 * MINUTE);

    expect(job.scheduledAt).toEqual(['2026-03-02T11:00:00.000Z']);
  });
});

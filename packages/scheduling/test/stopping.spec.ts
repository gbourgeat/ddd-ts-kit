import { describe, expect, it } from 'vitest';
import { JobAbortedError } from '../src';
import { aBench } from './support/a-bench';
import { HOUR, MINUTE } from './support/durations';
import { InMemoryJobCheckpoints } from './support/in-memory-job-checkpoints';
import { EXPORT, REMINDERS } from './support/job-names';
import { QUARTERLY } from './support/quarterly';
import { RecordingJob } from './support/recording-job';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections';

refuseUnhandledRejections();

/** Checkpoints whose writes wait until the test lets them through, as a slow database would. */
class GatedCheckpoints extends InMemoryJobCheckpoints {
  private release: (() => void) | undefined;

  override async write(job: string, handled: Date): Promise<void> {
    await new Promise<void>((resolve) => {
      this.release = resolve;
    });

    return super.write(job, handled);
  }

  open(): void {
    this.release?.();
  }
}

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

  it('arms no timer for a job whose checkpoint was being written when the stop came', async () => {
    const checkpoints = new GatedCheckpoints();
    const { scheduler } = aBench({ checkpoints });
    const job = new RecordingJob();

    scheduler.register({ name: EXPORT, schedule: { every: '1m' }, run: job.run });
    await scheduler.start();
    await scheduler.advance(30_000);
    expect(job.scheduledAt).toEqual(['2026-03-02T09:59:00.000Z']);

    const stopping = scheduler.stop();

    checkpoints.open();
    await stopping;

    expect(checkpoints.handled.get(EXPORT)).toEqual(new Date('2026-03-02T09:59:00.000Z'));
    expect(scheduler.timers.pending).toBe(0);

    await scheduler.advance(HOUR);
    expect(job.executions).toHaveLength(1);
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

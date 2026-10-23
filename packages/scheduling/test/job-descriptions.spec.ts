import { describe, expect, it } from 'vitest';
import { aBench } from './support/a-bench';
import { MINUTE } from './support/durations';
import { EXPORT, REMINDERS } from './support/job-names';
import { QUARTERLY } from './support/quarterly';
import { RecordingJob } from './support/recording-job';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections';

refuseUnhandledRejections();

describe('what a scheduler says of its jobs', () => {
  it('describes its jobs: the next run, whether one is in progress, what became of the last', async () => {
    const { scheduler } = aBench();
    const job = new RecordingJob();

    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: job.run });
    scheduler.register({ name: EXPORT, schedule: { cron: '0 3 * * *' }, enabled: false, run: job.run });

    expect(scheduler.describe()).toEqual([
      { name: REMINDERS, schedule: 'every 15m', enabled: true, running: false },
      { name: EXPORT, schedule: 'cron 0 3 * * * (UTC)', enabled: false, running: false },
    ]);

    await scheduler.start();
    job.gate();
    await scheduler.advance(2 * MINUTE);

    expect(scheduler.describe()[0]).toEqual({
      name: REMINDERS,
      schedule: 'every 15m',
      enabled: true,
      running: true,
      nextRunAt: new Date('2026-03-02T10:15:00.000Z'),
    });

    job.open();
    await scheduler.advance(MINUTE);

    expect(scheduler.describe()[0]?.lastRun).toEqual({
      job: REMINDERS,
      outcome: 'succeeded',
      scheduledAt: new Date('2026-03-02T10:00:00.000Z'),
      startedAt: new Date('2026-03-02T10:00:00.000Z'),
      durationMs: 30_000,
    });

    expect(scheduler.describe()[1]).toEqual({
      name: EXPORT,
      schedule: 'cron 0 3 * * * (UTC)',
      enabled: false,
      running: false,
    });
  });
});

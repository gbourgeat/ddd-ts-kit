import { describe, expect, it } from 'vitest';
import { aBench } from './support/a-bench.js';
import { MINUTE } from './support/durations.js';
import { EXPORT, REMINDERS } from './support/job-names.js';
import { InMemoryJobCheckpoints } from './support/in-memory-job-checkpoints.js';
import { QUARTERLY } from './support/quarterly.js';
import { RecordingJob } from './support/recording-job.js';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections.js';

refuseUnhandledRejections();

describe('occurrences that passed while the process was down', () => {
  it('are forgotten by a restart without checkpoints: nothing says what passed while the process was down', async () => {
    const { scheduler } = aBench();
    const job = new RecordingJob();

    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, missed: 'run-once', run: job.run });

    await scheduler.start();
    await scheduler.advance(0);

    expect(scheduler.runs).toEqual([]);
  });

  it('are known to a restart with checkpoints, which runs the latest once or skips them, as the job says', async () => {
    const checkpoints = new InMemoryJobCheckpoints();

    checkpoints.handled.set(REMINDERS, new Date('2026-03-02T07:00:00.000Z'));
    checkpoints.handled.set(EXPORT, new Date('2026-03-02T07:00:00.000Z'));
    const { scheduler } = aBench({ checkpoints });
    const reminders = new RecordingJob();
    const ledger = new RecordingJob();

    scheduler.register({ name: REMINDERS, schedule: { every: '1h' }, missed: 'run-once', run: reminders.run });
    scheduler.register({ name: EXPORT, schedule: { every: '1h' }, run: ledger.run });

    await scheduler.start();
    await scheduler.advance(0);

    expect(reminders.scheduledAt).toEqual(['2026-03-02T09:00:00.000Z']);
    expect(ledger.executions).toEqual([]);
    expect(scheduler.runsOf(EXPORT)).toEqual([{ job: EXPORT, outcome: 'missed', scheduledAt: new Date('2026-03-02T08:00:00.000Z') }]);
    expect(checkpoints.handled.get(EXPORT)).toEqual(new Date('2026-03-02T09:00:00.000Z'));

    await scheduler.advance(2 * MINUTE);
    expect(checkpoints.handled.get(REMINDERS)).toEqual(new Date('2026-03-02T10:00:00.000Z'));
  });

  it('survive a checkpoint store that fails: the job starts from now, and runs although nothing is remembered', async () => {
    const failing = { read: () => Promise.reject(new Error('store down')), write: () => Promise.reject(new Error('store down')) };
    const { scheduler, logger } = aBench({ checkpoints: failing });
    const job = new RecordingJob();

    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: job.run });
    await scheduler.start();

    await scheduler.advance(17 * MINUTE);

    expect(job.scheduledAt).toEqual(['2026-03-02T10:00:00.000Z', '2026-03-02T10:15:00.000Z']);
    expect(logger.entries.filter((entry) => entry.message === 'Scheduled job could not be followed')).toHaveLength(3);
    expect(JSON.stringify(logger.entries)).not.toContain('store down');
  });
});

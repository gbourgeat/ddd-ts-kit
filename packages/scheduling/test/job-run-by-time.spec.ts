import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator, type ExecutionContext } from '@ddd-ts-kit/kernel';
import { InProcessJobScheduler } from '../src/index.js';
import { ManualJobTimers } from '../src/testing.js';
import { aBench } from './support/a-bench.js';
import { HOUR, MINUTE } from './support/durations.js';
import { REMINDERS } from './support/job-names.js';
import { QUARTERLY } from './support/quarterly.js';
import { RecordingJob } from './support/recording-job.js';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections.js';

refuseUnhandledRejections();

describe('a job run by time', () => {
  it('runs at each occurrence, told the instant it was due and the instant it started', async () => {
    const { scheduler } = aBench();
    const job = new RecordingJob();

    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: job.run });
    await scheduler.start();

    await scheduler.advance(2 * MINUTE);
    expect(job.scheduledAt).toEqual(['2026-03-02T10:00:00.000Z']);
    expect(job.executions[0]).toMatchObject({ startedAt: new Date('2026-03-02T10:00:00.000Z'), attempt: 1 });

    await scheduler.advance(30 * MINUTE);

    expect(job.scheduledAt).toEqual([
      '2026-03-02T10:00:00.000Z',
      '2026-03-02T10:15:00.000Z',
      '2026-03-02T10:30:00.000Z',
    ]);

    expect(scheduler.runs.map((run) => run.outcome)).toEqual(['succeeded', 'succeeded', 'succeeded']);
  });

  it('follows a cron expression on the clocks of its zone', async () => {
    const { scheduler } = aBench({ clock: new FixedClock(new Date('2026-03-27T12:00:00.000Z')) });
    const job = new RecordingJob();

    scheduler.register({ name: REMINDERS, schedule: { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' }, run: job.run });
    await scheduler.start();

    await scheduler.advance(4 * 24 * HOUR);

    // A Friday in winter time, a weekend with the change to summer time, then Monday and Tuesday.
    expect(job.scheduledAt).toEqual(['2026-03-30T05:00:00.000Z', '2026-03-31T05:00:00.000Z']);
  });

  it('sleeps through a long wait in short naps, and still runs on the instant', async () => {
    const { scheduler } = aBench();
    const job = new RecordingJob();

    scheduler.register({ name: REMINDERS, schedule: { every: '1d' }, run: job.run });
    await scheduler.start();

    await scheduler.advance(15 * HOUR);

    expect(job.executions).toMatchObject([
      { scheduledAt: new Date('2026-03-03T00:00:00.000Z'), startedAt: new Date('2026-03-03T00:00:00.000Z') },
    ]);
  });

  it('follows a job registered after it started, and starting twice changes nothing', async () => {
    const { scheduler } = aBench();
    const job = new RecordingJob();

    await scheduler.start();
    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: job.run });
    await scheduler.start();

    await scheduler.advance(2 * MINUTE);

    expect(job.scheduledAt).toEqual(['2026-03-02T10:00:00.000Z']);
  });

  it('delays each run by a jitter drawn up to jitterMs, and still names the instant that was due', async () => {
    const clock = new FixedClock(new Date('2026-03-02T09:58:30.000Z'));
    const timers = new ManualJobTimers(clock);
    const { scope, lock } = aBench({ clock });

    const scheduler = new InProcessJobScheduler({
      clock,
      lock,
      scope,
      ids: new SequentialIdGenerator(),
      timers,
      random: () => 0.5,
    });

    const job = new RecordingJob();

    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, jitterMs: 10_000, run: job.run });
    await scheduler.start();

    await timers.advance(2 * MINUTE);

    expect(job.executions).toMatchObject([
      { scheduledAt: new Date('2026-03-02T10:00:00.000Z'), startedAt: new Date('2026-03-02T10:00:05.000Z') },
    ]);
  });
});

describe('the execution scope of a run', () => {
  it('is opened by the scheduler: origin schedule, the system actor of the job, a fresh correlation, the due instant, the deadline', async () => {
    const { scheduler, scope } = aBench();
    const seen: (ExecutionContext | undefined)[] = [];

    scheduler.register({
      name: REMINDERS,
      schedule: QUARTERLY,
      timeoutMs: 5 * MINUTE,
      run: async () => void seen.push(scope.current()),
    });

    await scheduler.start();

    await scheduler.advance(20 * MINUTE);

    expect(seen).toMatchObject([
      {
        origin: 'schedule',
        actor: { id: `system:${REMINDERS}`, type: 'system' },
        correlationId: 'run-1',
        scheduledAt: new Date('2026-03-02T10:00:00.000Z'),
        deadline: new Date('2026-03-02T10:05:00.000Z'),
      },
      { correlationId: 'run-2', scheduledAt: new Date('2026-03-02T10:15:00.000Z') },
    ]);

    expect(scope.current()).toBeUndefined();
  });
});

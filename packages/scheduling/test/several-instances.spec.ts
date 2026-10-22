import { describe, expect, it } from 'vitest';
import { FixedClock, InMemoryLock, type JobExecution, type Lock } from '@ddd-ts-kit/kernel';
import { aBench } from './support/a-bench';
import { MINUTE } from './support/durations';
import { EXPORT, REMINDERS } from './support/job-names';
import { ObservedLock } from './support/observed-lock';
import { QUARTERLY } from './support/quarterly';
import { RecordingJob } from './support/recording-job';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections';

refuseUnhandledRejections();

describe('several instances of an application', () => {
  function twoInstances(options: { singleInstance?: boolean } = {}) {
    const clock = new FixedClock(new Date('2026-03-02T09:58:30.000Z'));
    const lock = new ObservedLock(new InMemoryLock(clock));
    const instances = [aBench({ clock, lock }), aBench({ clock, lock })] as const;
    const jobs = [new RecordingJob(), new RecordingJob()] as const;

    instances.forEach(({ scheduler }, index) => {
      scheduler.register({
        name: REMINDERS,
        schedule: QUARTERLY,
        ...options,
        run: (execution: JobExecution) => (jobs[index] ?? jobs[0]).run(execution),
      });
    });

    return { lock, instances, jobs, executions: () => jobs.flatMap((job) => job.scheduledAt) };
  }

  it('run each occurrence on one of them: the lock of the occurrence decides', async () => {
    const { instances, jobs, executions } = twoInstances();
    const [first, second] = instances;

    await Promise.all(instances.map(({ scheduler }) => scheduler.start()));

    await first.scheduler.advance(2 * MINUTE);
    await second.scheduler.advance(0);
    expect(executions()).toEqual(['2026-03-02T10:00:00.000Z']);

    expect(second.scheduler.runs).toEqual([
      { job: REMINDERS, outcome: 'skipped-locked', scheduledAt: new Date('2026-03-02T10:00:00.000Z') },
    ]);

    await second.scheduler.advance(15 * MINUTE);
    await first.scheduler.advance(0);
    expect(jobs[1].scheduledAt).toEqual(['2026-03-02T10:15:00.000Z']);
    expect(executions()).toHaveLength(2);
  });

  it('keep the lock after the run, for the time the occurrence may still be tried: timeout, jitter and lateness', async () => {
    const clock = new FixedClock(new Date('2026-03-02T09:58:30.000Z'));
    const lock = new ObservedLock(new InMemoryLock(clock));
    const { scheduler } = aBench({ clock, lock, lateAfterMs: 30_000 });

    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, timeoutMs: 5 * MINUTE, run: async () => undefined });
    scheduler.register({ name: EXPORT, schedule: QUARTERLY, run: async () => undefined });
    await scheduler.start();

    await scheduler.advance(2 * MINUTE);

    expect(lock.asked).toEqual([
      { key: `job:${REMINDERS}:2026-03-02T10:00:00.000Z`, ttlMs: 5 * MINUTE + 30_000 },
      { key: `job:${EXPORT}:2026-03-02T10:00:00.000Z`, ttlMs: 15 * MINUTE + 30_000 },
    ]);

    expect(await lock.acquire(`job:${REMINDERS}:2026-03-02T10:00:00.000Z`, { ttlMs: 1 })).toBeUndefined();

    await scheduler.advance(15 * MINUTE);
    expect(await lock.acquire(`job:${EXPORT}:2026-03-02T10:00:00.000Z`, { ttlMs: 1 })).toBeDefined();
  });

  it('all run a job that says singleInstance false, and a run asked with runNow takes no lock', async () => {
    const { lock, instances, executions } = twoInstances({ singleInstance: false });
    const [first, second] = instances;

    await Promise.all(instances.map(({ scheduler }) => scheduler.start()));

    await first.scheduler.advance(2 * MINUTE);
    await second.scheduler.advance(0);
    await first.scheduler.runNow(REMINDERS);

    expect(executions()).toHaveLength(3);
    expect(lock.asked).toEqual([]);
  });

  it('do not run an occurrence whose lock cannot be asked, and try the next one', async () => {
    let down = true;
    const clock = new FixedClock(new Date('2026-03-02T09:58:30.000Z'));
    const memory = new InMemoryLock(clock);

    const lock: Lock = {
      acquire: (key, options) =>
        down ? Promise.reject(new Error('redis://secret@host is down')) : memory.acquire(key, options),
    };

    const { scheduler, logger } = aBench({ clock, lock });
    const job = new RecordingJob();

    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: job.run });
    await scheduler.start();

    await scheduler.advance(2 * MINUTE);
    down = false;
    await scheduler.advance(15 * MINUTE);

    expect(scheduler.runs).toMatchObject([
      { outcome: 'failed', errorCode: 'JOB_LOCK_UNAVAILABLE' },
      { outcome: 'succeeded' },
    ]);

    expect(job.scheduledAt).toEqual(['2026-03-02T10:15:00.000Z']);
    expect(JSON.stringify(logger.entries)).not.toContain('secret');
  });
});

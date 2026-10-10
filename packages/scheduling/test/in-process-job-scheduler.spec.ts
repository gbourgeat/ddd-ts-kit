import { afterAll, describe, expect, it } from 'vitest';
import {
  DomainError,
  FixedClock,
  InMemoryLock,
  SequentialIdGenerator,
  type AcquireOptions,
  type ExecutionContext,
  type JobExecution,
  type Lock,
  type LockHandle,
} from '@ddd-ts-kit/kernel';
import { DURATION_HISTOGRAM, InProcessJobScheduler, JobAbortedError, JobTimeoutError, RUNS_COUNTER } from '../src/index.js';
import { ManualJobTimers } from '../src/testing.js';
import { HOUR, InMemoryJobCheckpoints, MINUTE, RecordingJob, aBench } from './support.js';

const REMINDERS = 'billing.send-reminders';
const EXPORT = 'billing.export-ledger';
const QUARTERLY = { every: '15m' } as const;

const unhandled: unknown[] = [];
const collect = (reason: unknown): void => void unhandled.push(reason);
process.on('unhandledRejection', collect);

afterAll(() => {
  process.off('unhandledRejection', collect);
  expect(unhandled).toEqual([]);
});

class LedgerClosed extends DomainError {
  readonly code = 'LEDGER_CLOSED';
}

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
    expect(job.scheduledAt).toEqual(['2026-03-02T10:00:00.000Z', '2026-03-02T10:15:00.000Z', '2026-03-02T10:30:00.000Z']);
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

    expect(job.executions).toMatchObject([{ scheduledAt: new Date('2026-03-03T00:00:00.000Z'), startedAt: new Date('2026-03-03T00:00:00.000Z') }]);
  });

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
    expect(scheduler.describe()[0]).toEqual({ name: REMINDERS, schedule: 'every 15m', enabled: true, running: true, nextRunAt: new Date('2026-03-02T10:15:00.000Z') });

    job.open();
    await scheduler.advance(MINUTE);
    expect(scheduler.describe()[0]?.lastRun).toEqual({
      job: REMINDERS,
      outcome: 'succeeded',
      scheduledAt: new Date('2026-03-02T10:00:00.000Z'),
      startedAt: new Date('2026-03-02T10:00:00.000Z'),
      durationMs: 30_000,
    });
    expect(scheduler.describe()[1]).toEqual({ name: EXPORT, schedule: 'cron 0 3 * * * (UTC)', enabled: false, running: false });
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
    const scheduler = new InProcessJobScheduler({ clock, lock, scope, ids: new SequentialIdGenerator(), timers, random: () => 0.5 });
    const job = new RecordingJob();
    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, jitterMs: 10_000, run: job.run });
    await scheduler.start();

    await timers.advance(2 * MINUTE);

    expect(job.executions).toMatchObject([{ scheduledAt: new Date('2026-03-02T10:00:00.000Z'), startedAt: new Date('2026-03-02T10:00:05.000Z') }]);
  });
});

describe('the execution scope of a run', () => {
  it('is opened by the scheduler: origin schedule, the system actor of the job, a fresh correlation, the due instant, the deadline', async () => {
    const { scheduler, scope } = aBench();
    const seen: (ExecutionContext | undefined)[] = [];
    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, timeoutMs: 5 * MINUTE, run: async () => void seen.push(scope.current()) });
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
    expect(scheduler.runs).toMatchObject([{ outcome: 'skipped-overlap', scheduledAt: new Date('2026-03-02T10:30:00.000Z') }]);

    job.open();
    await scheduler.advance(MINUTE);
    expect(job.executions).toMatchObject([
      { scheduledAt: new Date('2026-03-02T10:00:00.000Z') },
      { scheduledAt: new Date('2026-03-02T10:15:00.000Z'), startedAt: new Date('2026-03-02T10:30:30.000Z') },
    ]);
  });
});

describe('occurrences that passed without being reached', () => {
  /** The process is frozen: the clock moves and no timer fires until it wakes up. */
  async function asleepFor(bench: ReturnType<typeof aBench>, ms: number): Promise<void> {
    bench.clock.advance(ms);
    await bench.scheduler.advance(0);
  }

  it('are skipped by default: the job waits for its next occurrence', async () => {
    const bench = aBench();
    const job = new RecordingJob();
    bench.scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: job.run });
    await bench.scheduler.start();

    await asleepFor(bench, 50 * MINUTE);
    expect(job.executions).toEqual([]);
    expect(bench.scheduler.runs).toEqual([{ job: REMINDERS, outcome: 'missed', scheduledAt: new Date('2026-03-02T10:00:00.000Z') }]);

    await bench.scheduler.advance(15 * MINUTE);
    expect(job.scheduledAt).toEqual(['2026-03-02T11:00:00.000Z']);
  });

  it('are run once under missed run-once: the latest of them, however many passed', async () => {
    const bench = aBench();
    const job = new RecordingJob();
    bench.scheduler.register({ name: REMINDERS, schedule: QUARTERLY, missed: 'run-once', run: job.run });
    await bench.scheduler.start();

    await asleepFor(bench, 50 * MINUTE);

    expect(job.executions).toMatchObject([{ scheduledAt: new Date('2026-03-02T10:45:00.000Z'), startedAt: new Date('2026-03-02T10:48:30.000Z') }]);
    expect(bench.scheduler.runs.map((run) => run.outcome)).toEqual(['missed', 'succeeded']);
  });

  it('are not missed when reached within lateAfterMs: a late timer still runs its occurrence', async () => {
    const bench = aBench({ lateAfterMs: 2 * MINUTE });
    const job = new RecordingJob();
    bench.scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: job.run });
    await bench.scheduler.start();

    await asleepFor(bench, 3 * MINUTE);
    expect(job.scheduledAt).toEqual(['2026-03-02T10:00:00.000Z']);

    await asleepFor(bench, 16 * MINUTE);
    expect(bench.scheduler.runs.map((run) => run.outcome)).toEqual(['succeeded', 'missed']);
  });

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

/** A lock that remembers what it was asked, in front of a real one. */
class ObservedLock implements Lock {
  readonly asked: { key: string; ttlMs: number }[] = [];

  constructor(private readonly lock: Lock) {}

  acquire(key: string, options: AcquireOptions): Promise<LockHandle | undefined> {
    this.asked.push({ key, ttlMs: options.ttlMs });
    return this.lock.acquire(key, options);
  }
}

describe('several instances of an application', () => {
  function twoInstances(options: { singleInstance?: boolean } = {}) {
    const clock = new FixedClock(new Date('2026-03-02T09:58:30.000Z'));
    const lock = new ObservedLock(new InMemoryLock(clock));
    const instances = [aBench({ clock, lock }), aBench({ clock, lock })] as const;
    const jobs = [new RecordingJob(), new RecordingJob()] as const;
    instances.forEach(({ scheduler }, index) => {
      scheduler.register({ name: REMINDERS, schedule: QUARTERLY, ...options, run: (execution: JobExecution) => (jobs[index] ?? jobs[0]).run(execution) });
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
    expect(second.scheduler.runs).toEqual([{ job: REMINDERS, outcome: 'skipped-locked', scheduledAt: new Date('2026-03-02T10:00:00.000Z') }]);

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
    const lock: Lock = { acquire: (key, options) => (down ? Promise.reject(new Error('redis://secret@host is down')) : memory.acquire(key, options)) };
    const { scheduler, logger } = aBench({ clock, lock });
    const job = new RecordingJob();
    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: job.run });
    await scheduler.start();

    await scheduler.advance(2 * MINUTE);
    down = false;
    await scheduler.advance(15 * MINUTE);

    expect(scheduler.runs).toMatchObject([{ outcome: 'failed', errorCode: 'JOB_LOCK_UNAVAILABLE' }, { outcome: 'succeeded' }]);
    expect(job.scheduledAt).toEqual(['2026-03-02T10:15:00.000Z']);
    expect(JSON.stringify(logger.entries)).not.toContain('secret');
  });
});

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
      { message: 'Scheduled job failed', fields: { job: EXPORT, context: 'billing', outcome: 'failed', errorCode: 'LEDGER_CLOSED', errorType: 'LedgerClosed', correlationId: 'run-1' } },
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

  it('is still run and answered when the logger and the metrics themselves throw', async () => {
    const broken = (): never => {
      throw new Error('collector down');
    };
    const { scheduler } = aBench({
      logger: { debug: broken, info: broken, warn: broken, error: broken, child: broken },
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
        fields: { job: REMINDERS, context: 'billing', outcome: 'succeeded', scheduledAt: new Date('2026-03-02T10:00:00.000Z'), durationMs: 1_200, correlationId: 'run-1' },
      },
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

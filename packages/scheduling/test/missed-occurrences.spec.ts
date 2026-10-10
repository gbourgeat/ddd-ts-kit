import { describe, expect, it } from 'vitest';
import { aBench, type Bench } from './support/a-bench.js';
import { MINUTE } from './support/durations.js';
import { REMINDERS } from './support/job-names.js';
import { QUARTERLY } from './support/quarterly.js';
import { RecordingJob } from './support/recording-job.js';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections.js';

refuseUnhandledRejections();

describe('occurrences that passed without being reached', () => {
  /** The process is frozen: the clock moves and no timer fires until it wakes up. */
  async function asleepFor(bench: Bench, ms: number): Promise<void> {
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
});

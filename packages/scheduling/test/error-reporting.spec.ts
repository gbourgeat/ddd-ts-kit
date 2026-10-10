import { describe, expect, it } from 'vitest';
import { InMemoryErrorReporter } from '@ddd-ts-kit/kernel';
import { reportFailedRuns } from '../src/index.js';
import { aBench } from './support/a-bench.js';
import { MINUTE } from './support/durations.js';
import { EXPORT, REMINDERS } from './support/job-names.js';
import { LedgerClosed } from './support/ledger-closed.js';
import { QUARTERLY } from './support/quarterly.js';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections.js';

refuseUnhandledRejections();

describe('reportFailedRuns', () => {
  it('reports the run that failed with a fault, as the job, with the correlation of the run', async () => {
    const errors = new InMemoryErrorReporter();
    const { scheduler } = aBench({ onRun: reportFailedRuns(errors) });
    const failure = new TypeError('x is not a function');

    scheduler.register({ name: EXPORT, schedule: QUARTERLY, run: () => Promise.reject(failure) });
    scheduler.register({ name: REMINDERS, schedule: QUARTERLY, run: () => Promise.resolve() });
    await scheduler.start();
    await scheduler.advance(2 * MINUTE);

    expect(errors.reports).toEqual([
      {
        error: failure,
        report: {
          origin: 'schedule',
          operation: EXPORT,
          context: 'billing',
          correlationId: 'run-1',
          actorId: `system:${EXPORT}`,
          severity: 'error',
        },
      },
    ]);
  });

  it('reports a run that timed out by the code of the timeout', async () => {
    const errors = new InMemoryErrorReporter();
    const { scheduler } = aBench({ onRun: reportFailedRuns(errors) });

    scheduler.register({
      name: EXPORT,
      schedule: QUARTERLY,
      timeoutMs: MINUTE,
      run: () => new Promise(() => undefined),
    });

    await scheduler.start();
    await scheduler.advance(3 * MINUTE);

    expect(errors.reports).toMatchObject([{ report: { operation: EXPORT, errorCode: 'JOB_TIMEOUT' } }]);
  });

  it('reports neither a business refusal nor an occurrence that did not run', async () => {
    const errors = new InMemoryErrorReporter();
    const { scheduler } = aBench({ onRun: reportFailedRuns(errors) });

    scheduler.register({
      name: EXPORT,
      schedule: QUARTERLY,
      run: () => Promise.reject(new LedgerClosed('The ledger is closed')),
    });

    scheduler.register({
      name: REMINDERS,
      schedule: QUARTERLY,
      enabled: true,
      run: () => new Promise(() => undefined),
    });

    await scheduler.start();
    await scheduler.advance(40 * MINUTE);

    expect(scheduler.runs.map((run) => run.outcome)).toContain('skipped-overlap');
    expect(errors.reports).toEqual([]);
  });
});

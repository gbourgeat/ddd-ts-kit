import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  InMemoryLock,
  SequentialIdGenerator,
  type JobDefinition,
  type JobRun,
} from '@ddd-ts-kit/kernel';
import { ManualJobScheduler } from '@ddd-ts-kit/scheduling/testing';
import { jobSchedulerContract, type JobSchedulerUnderContract } from '../src/contracts';
import { CollectingRunner } from './support/collecting-runner';

// The in-process scheduler on manual timers, held to the contract as every adapter is.
jobSchedulerContract(
  { describe, it, expect, beforeEach, afterEach },
  {
    name: 'InProcessJobScheduler on manual timers',
    createScheduler: () => {
      const clock = new FixedClock(new Date('2026-03-02T09:58:30.000Z'));
      const scope = new AsyncLocalStorageExecutionScope();

      const scheduler = new ManualJobScheduler({
        clock,
        scope,
        lock: new InMemoryLock(clock),
        ids: new SequentialIdGenerator('run'),
      });

      return { scheduler, scope, elapse: (ms) => scheduler.advance(ms) };
    },
  },
);

/** A scheduler that runs a job as soon as it is registered, instead of waiting for its time or a request. */
class EagerScheduler extends ManualJobScheduler {
  override register(job: JobDefinition): void {
    super.register(job);
    void this.runNow(job.name);
  }
}

/** A scheduler that answers a run for a name nobody registered, instead of refusing it. */
class LenientScheduler extends ManualJobScheduler {
  override runNow(name: string): Promise<JobRun> {
    return super.runNow(name).catch(() => ({ job: name, outcome: 'succeeded', scheduledAt: new Date(0) }));
  }
}

function underContract(
  scheduler: ManualJobScheduler,
  scope: AsyncLocalStorageExecutionScope,
): JobSchedulerUnderContract {
  return { scheduler, scope, elapse: (ms) => scheduler.advance(ms) };
}

function parts() {
  const clock = new FixedClock(new Date('2026-03-02T09:58:30.000Z'));
  const scope = new AsyncLocalStorageExecutionScope();

  return { clock, scope, lock: new InMemoryLock(clock), ids: new SequentialIdGenerator('run') };
}

describe('the job scheduler contract and a broken scheduler', () => {
  it('fails a scheduler that runs a job on its registration wherever a run is counted', async () => {
    const collecting = new CollectingRunner();

    jobSchedulerContract(collecting, {
      name: 'eager',
      createScheduler: () => {
        const { scope, ...rest } = parts();

        return underContract(new EagerScheduler({ scope, ...rest }), scope);
      },
    });

    const { failed } = await collecting.run();

    expect(failed).toContain('describes a registered job by its name and its schedule, before any run');
    expect(failed).toContain('runs a job at once when asked, started or not, and says what became of it');
  });

  it('fails a scheduler that runs a job nobody registered, on that alone', async () => {
    const collecting = new CollectingRunner();

    jobSchedulerContract(collecting, {
      name: 'lenient',
      createScheduler: () => {
        const { scope, ...rest } = parts();

        return underContract(new LenientScheduler({ scope, ...rest }), scope);
      },
    });

    const { failed } = await collecting.run();

    expect(failed).toEqual(['rejects the run of a job nobody registered']);
  });
});

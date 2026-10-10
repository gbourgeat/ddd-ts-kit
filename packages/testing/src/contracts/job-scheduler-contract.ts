import type { ExecutionContext, ExecutionScope, JobExecution, JobScheduler } from '@ddd-ts-kit/kernel';
import type { Awaitable } from './awaitable.js';
import type { ContractRunner } from './contract-runner.js';
import { ContractSuite } from './contract-suite.js';

export interface JobSchedulerUnderContract {
  readonly scheduler: JobScheduler;
  /** The scope the scheduler runs its jobs in. */
  readonly scope: ExecutionScope;
  /**
   * Makes the time of the scheduler pass and lets the runs that became due finish: advances its
   * clock and timers, or really waits. The suite asks for a few seconds at most.
   */
  elapse(ms: number): Awaitable<void>;
}

export interface JobSchedulerContractOptions {
  readonly name: string;
  /** A scheduler without job, not started; called before each test. */
  createScheduler(): Awaitable<JobSchedulerUnderContract>;
}

/** What every adapter of the kernel `JobScheduler` port guarantees, the in-process one included. */
export function jobSchedulerContract(runner: ContractRunner, options: JobSchedulerContractOptions): void {
  new JobSchedulerSuite(runner, options).describe(`${options.name} (job scheduler contract)`);
}

const EVERY_SECOND = { every: '1s' } as const;
const REMINDERS = 'billing.send-reminders';
const EXPORT = 'billing.export-ledger';

class CodedFailure extends Error {
  readonly code = 'LEDGER_CLOSED';
}

class JobSchedulerSuite extends ContractSuite<JobSchedulerUnderContract> {
  constructor(runner: ContractRunner, options: JobSchedulerContractOptions) {
    super(runner, () => options.createScheduler());
  }

  protected tests(): void {
    this.afterEach(async () => {
      await this.scheduler.stop();
    });

    this.registers();
    this.runsOnDemand();
    this.runsOnDemandOnly();
    this.runsByTime();
    this.doesNotOverlap();
    this.isolatesFailures();
    this.opensAScope();
  }

  private get scheduler(): JobScheduler {
    return this.subject.scheduler;
  }

  private registers(): void {
    this.it('describes a registered job by its name and its schedule, before any run', async () => {
      this.scheduler.register({
        name: REMINDERS,
        schedule: { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' },
        run: async () => undefined,
      });

      this.expect(this.scheduler.describe()).toEqual([
        { name: REMINDERS, schedule: 'cron 0 7 * * 1-5 (Europe/Paris)', enabled: true, running: false },
      ]);
    });

    this.it('refuses a second job under a name already registered', async () => {
      this.scheduler.register({ name: REMINDERS, schedule: EVERY_SECOND, run: async () => undefined });

      this.expect(
        codeOf(() => this.scheduler.register({ name: REMINDERS, schedule: EVERY_SECOND, run: async () => undefined })),
      ).toBe('DUPLICATE_JOB');
    });

    this.it('refuses a schedule it cannot read', async () => {
      this.expect(
        codeOf(() =>
          this.scheduler.register({ name: REMINDERS, schedule: { cron: 'every day' }, run: async () => undefined }),
        ),
      ).toBe('INVALID_JOB_SCHEDULE');
    });
  }

  private runsOnDemand(): void {
    this.it('runs a job at once when asked, started or not, and says what became of it', async () => {
      const executions: JobExecution[] = [];

      this.scheduler.register({
        name: REMINDERS,
        schedule: EVERY_SECOND,
        run: async (execution) => void executions.push(execution),
      });

      const run = await this.scheduler.runNow(REMINDERS);

      this.expect([run.job, run.outcome, executions.length]).toEqual([REMINDERS, 'succeeded', 1]);
      this.expect(executions[0]?.scheduledAt.getTime()).toBe(run.scheduledAt.getTime());
      this.expect([executions[0]?.attempt, executions[0]?.signal.aborted]).toEqual([1, false]);
      this.expect(this.scheduler.describe()[0]?.lastRun?.outcome).toBe('succeeded');
    });
  }

  private runsOnDemandOnly(): void {
    this.it('runs a disabled job when asked, and never by time', async () => {
      let runs = 0;

      this.scheduler.register({
        name: REMINDERS,
        schedule: EVERY_SECOND,
        enabled: false,
        run: async () => void (runs += 1),
      });

      await this.scheduler.start();

      await this.subject.elapse(2_500);
      this.expect([runs, this.scheduler.describe()[0]?.enabled]).toEqual([0, false]);

      await this.scheduler.runNow(REMINDERS);
      this.expect(runs).toBe(1);
    });

    this.it('rejects the run of a job nobody registered', async () => {
      const failure = await this.scheduler.runNow('billing.unknown').then(
        () => undefined,
        (error: unknown) => error,
      );

      this.expect(codeOf(() => rethrow(failure))).toBe('UNKNOWN_JOB');
    });
  }

  private runsByTime(): void {
    this.it('runs nothing until it is started, then each job when it is due', async () => {
      let runs = 0;

      this.scheduler.register({ name: REMINDERS, schedule: EVERY_SECOND, run: async () => void (runs += 1) });

      await this.subject.elapse(1_500);
      this.expect(runs).toBe(0);

      await this.scheduler.start();
      await this.subject.elapse(2_500);
      this.expect(runs >= 2).toBe(true);
      this.expect(this.scheduler.describe()[0]?.nextRunAt instanceof Date).toBe(true);
    });

    this.it('runs nothing more once stopped', async () => {
      let runs = 0;

      this.scheduler.register({ name: REMINDERS, schedule: EVERY_SECOND, run: async () => void (runs += 1) });
      await this.scheduler.start();
      await this.subject.elapse(1_500);

      await this.scheduler.stop();
      const before = runs;

      await this.subject.elapse(2_500);

      this.expect(runs).toBe(before);
    });
  }

  private doesNotOverlap(): void {
    this.it('does not start a job again while its previous run is in progress', async () => {
      let started = 0;
      let finish = (): void => undefined;

      const blocked = new Promise<void>((resolve) => {
        finish = resolve;
      });

      this.scheduler.register({ name: EXPORT, schedule: EVERY_SECOND, run: () => ((started += 1), blocked) });
      await this.scheduler.start();

      await this.subject.elapse(3_500);
      this.expect([started, this.scheduler.describe()[0]?.running]).toEqual([1, true]);

      finish();
    });
  }

  private isolatesFailures(): void {
    this.it(
      'answers failed with the code of the error, never rejecting, and keeps running the other jobs',
      async () => {
        let runs = 0;

        this.scheduler.register({
          name: EXPORT,
          schedule: EVERY_SECOND,
          run: () => Promise.reject(new CodedFailure('the ledger of ACME is closed')),
        });

        this.scheduler.register({ name: REMINDERS, schedule: EVERY_SECOND, run: async () => void (runs += 1) });
        await this.scheduler.start();

        await this.subject.elapse(2_500);
        const run = await this.scheduler.runNow(EXPORT);

        this.expect([run.outcome, run.errorCode]).toEqual(['failed', 'LEDGER_CLOSED']);
        this.expect(JSON.stringify(this.scheduler.describe()).includes('ACME')).toBe(false);
        this.expect(runs >= 2).toBe(true);
      },
    );

    this.it('answers failed for a job that throws before it answers a promise', async () => {
      this.scheduler.register({
        name: EXPORT,
        schedule: EVERY_SECOND,
        run: () => {
          throw new TypeError('not a function');
        },
      });

      this.expect((await this.scheduler.runNow(EXPORT)).outcome).toBe('failed');
    });
  }

  private opensAScope(): void {
    this.it(
      'runs each job in an execution context of its own: origin schedule, the system actor of the job',
      async () => {
        const seen: (ExecutionContext | undefined)[] = [];

        this.scheduler.register({
          name: REMINDERS,
          schedule: EVERY_SECOND,
          run: async () => void seen.push(this.subject.scope.current()),
        });

        const first = await this.scheduler.runNow(REMINDERS);

        await this.scheduler.runNow(REMINDERS);

        const [context, next] = seen;

        this.expect([context?.origin, context?.actor.id, context?.actor.type]).toEqual([
          'schedule',
          `system:${REMINDERS}`,
          'system',
        ]);

        this.expect(context?.scheduledAt?.getTime()).toBe(first.scheduledAt.getTime());

        this.expect(typeof context?.correlationId === 'string' && context.correlationId !== next?.correlationId).toBe(
          true,
        );
      },
    );
  }
}

function codeOf(attempt: () => unknown): unknown {
  try {
    attempt();

    return undefined;
  } catch (error) {
    return typeof error === 'object' && error !== null && 'code' in error ? error.code : error;
  }
}

function rethrow(failure: unknown): never {
  throw failure;
}

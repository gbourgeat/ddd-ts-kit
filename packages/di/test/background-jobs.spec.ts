import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  CommandBus,
  FixedClock,
  InMemoryLogger,
  JobQueue,
  ProcessRunner,
  err,
  ok,
  type BackgroundJob,
  type BackgroundJobExecution,
  type BackgroundJobPayloadSchema,
} from '@ddd-ts-kit/kernel';
import { Background } from '@ddd-ts-kit/kernel/declarations';
import { InMemoryJobStore, JobStore, QueueWorker } from '@ddd-ts-kit/scheduling';
import { lazyJobStore } from '../src/kernel/lazy-job-store';
import { defineContextModule, kernelModule, overrideForTests, type ModuleBuilder } from '../src';
import { createApplication, createTestApplication } from './support/on-container';
import { wiringFailure } from './support/failure';

interface Statements {
  readonly month: string;
}

/** The schema of the payload, written by hand: a month. */
const statements: BackgroundJobPayloadSchema<Statements> = {
  parse(input) {
    const month: unknown = Object(input).month;

    return typeof month === 'string'
      ? ok({ month })
      : err([{ path: 'month', code: 'invalid_type', message: 'A month.' }]);
  },
};

const months: string[] = [];

class CompileStatementsJob implements BackgroundJob<Statements> {
  static readonly jobName = 'billing.compile-statements';

  static readonly payload = statements;

  constructor(readonly commands: CommandBus) {}

  async run(payload: Statements, execution: BackgroundJobExecution): Promise<void> {
    months.push(`${payload.month} #${execution.attempt}`);
  }
}

Background({ maxAttempts: 3 }, [CommandBus])(CompileStatementsJob);

class SendStatementsJob implements BackgroundJob<Statements> {
  static readonly jobName = 'billing.send-statements';

  static readonly payload = statements;

  async run(payload: Statements): Promise<void> {
    months.push(`sent ${payload.month}`);
  }
}

const billing = (register: (builder: ModuleBuilder) => void) => defineContextModule({ name: 'billing', register });

describe('a declared background job', () => {
  it('is registered on the worker of the test application, and runs what a use case enqueued', async () => {
    months.length = 0;

    const app = createTestApplication({ modules: [billing((builder) => builder.include([CompileStatementsJob]))] });

    await app.resolve(JobQueue).enqueue(CompileStatementsJob, { month: '2026-02' });

    expect(await app.backgroundJobs.runDue()).toMatchObject([
      { job: 'billing.compile-statements', outcome: 'succeeded' },
    ]);

    expect(months).toEqual(['2026-02 #1']);
    expect(app.backgroundJobs.store.list()).toMatchObject([{ status: 'succeeded' }]);
  });

  it('is described with its queue and its options, defaults filled in', () => {
    const app = createApplication({
      modules: [kernelModule(), billing((builder) => builder.include([CompileStatementsJob]))],
    });

    expect(app.describe().backgroundJobs).toEqual([
      {
        name: 'billing.compile-statements',
        queue: 'billing',
        maxAttempts: 3,
        backoff: { baseMs: 1_000, factor: 2, maxMs: 300_000 },
        leaseMs: 30_000,
        job: 'CompileStatementsJob',
        module: 'billing',
        origin: 'declared',
        declaredBy: 'CompileStatementsJob',
      },
    ]);
  });
});

describe('a background job of an explicit module', () => {
  it('is registered under the static jobName of its class', async () => {
    months.length = 0;

    const app = createTestApplication({
      modules: [billing((builder) => builder.backgroundJob('billing.send-statements').handledBy(SendStatementsJob))],
    });

    await app.jobQueue.enqueue(SendStatementsJob, { month: '2026-03' });
    await app.backgroundJobs.runDue();

    expect(months).toEqual(['sent 2026-03']);
  });

  it('is refused under another name than the one of its class, and when declared twice', () => {
    const renamed = wiringFailure(() =>
      createApplication({
        modules: [billing((builder) => builder.backgroundJob('billing.mail-statements').handledBy(SendStatementsJob))],
      }),
    );

    const twice = wiringFailure(() =>
      createApplication({
        modules: [
          billing((builder) => {
            builder.include([CompileStatementsJob]);

            builder
              .backgroundJob('billing.compile-statements')
              .handledByFactory(() => new SendStatementsJob(), statements);
          }),
        ],
      }),
    );

    expect([renamed.code, twice.code]).toEqual(['INVALID_JOB_SETTINGS', 'DUPLICATE_JOB']);
  });

  it('throws in the test application what the attempt threw', async () => {
    const app = createTestApplication({
      modules: [
        billing((builder) =>
          builder
            .backgroundJob('billing.send-statements')
            .handledByFactory(() => ({ run: () => Promise.reject(new Error('mailer down')) }), statements),
        ),
      ],
    });

    await app.jobQueue.enqueue(SendStatementsJob, { month: '2026-03' });

    await expect(app.backgroundJobs.runDue()).rejects.toThrow('mailer down');
    expect(app.errors.reports).toMatchObject([{ report: { origin: 'queue', operation: 'billing.send-statements' } }]);
  });
});

describe('the worker of an application', () => {
  it('consumes the queues of its contexts while the application runs the jobs, and stops with it', async () => {
    months.length = 0;

    const clock = new FixedClock(new Date('2026-03-02T10:00:00.000Z'));
    const store = new InMemoryJobStore();

    const app = createApplication({
      modules: [
        kernelModule({ clock, jobStore: store, queues: { pollIntervalMs: 20 }, logger: new InMemoryLogger() }),
        billing((builder) => builder.include([CompileStatementsJob])),
      ],
    });

    await app.start();
    await app.resolve(JobQueue).enqueue(CompileStatementsJob, { month: '2026-04' });
    // The worker polls on the timers of the runtime: a few intervals pass.
    await new Promise((resolve) => setTimeout(resolve, 200));
    await app.stop();

    expect(months).toEqual(['2026-04 #1']);
    expect(app.resolve(JobStore)).toBe(store);
  });

  it('leaves a shared queue to the worker in a process that does not run the jobs', async () => {
    const store = new InMemoryJobStore();
    // Not an InMemoryJobStore to the application: a store other processes could reach.
    const shared = lazyJobStore(createApplication({ modules: [kernelModule({ jobStore: store })] }).resolve);

    const app = createApplication({
      modules: [kernelModule({ jobStore: shared }), billing((builder) => builder.include([CompileStatementsJob]))],
      jobs: { start: false },
    });

    await app.start();
    await app.resolve(JobQueue).enqueue(CompileStatementsJob, { month: '2026-05' });
    await app.stop();

    expect(store.list()).toMatchObject([{ status: 'waiting' }]);
  });

  it('consumes a queue kept in its own memory even with its jobs off: no other process sees it', async () => {
    months.length = 0;

    const app = createApplication({
      modules: [
        kernelModule({ queues: { pollIntervalMs: 20 }, logger: new InMemoryLogger() }),
        billing((builder) => builder.include([CompileStatementsJob])),
      ],
      jobs: { start: false },
    });

    await app.start();
    await app.resolve(JobQueue).enqueue(CompileStatementsJob, { month: '2026-06' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    await app.stop();

    expect(months).toEqual(['2026-06 #1']);
  });
});

describe('the queue ports of the kernel module', () => {
  it('reach the bound job store at each call, whatever replaced it since the worker was built', async () => {
    const store = new InMemoryJobStore();
    const app = createApplication({ modules: [kernelModule({ jobStore: store })] });
    const lazy = lazyJobStore(app.resolve);
    const now = new Date('2026-03-02T10:00:00.000Z');
    const lease = { id: 'job-1', attempt: 1 };
    const enqueuedBy = { correlationId: 'c', actor: { id: 'a', type: 'user' as const, roles: [], attributes: {} } };

    await lazy.add({
      id: 'job-1',
      name: 'billing.x',
      queue: 'billing',
      payload: {},
      enqueuedBy,
      enqueuedAt: now,
      runAt: now,
    });

    await lazy.claim({ queue: 'billing', limit: 1, now, leaseMs: 1_000 });

    const answers = [
      await lazy.heartbeat(lease, now),
      await lazy.update(lease, { progress: { done: 1 } }, now),
      await lazy.release(lease, now),
      (await lazy.claim({ queue: 'billing', limit: 1, now, leaseMs: 1_000 })).length,
      await lazy.fail(lease, { errorCode: 'X', retryAt: null, at: now }),
      await lazy.retryDead(['job-1'], now),
      await lazy.cancel('job-1', now),
      (await lazy.find('job-1'))?.status,
      await lazy.purgeFinished(new Date(now.getTime() + 1)),
      await lazy.stats('billing'),
      await lazy.complete(lease, now),
    ];

    expect(answers).toEqual([
      true,
      true,
      true,
      1,
      true,
      1,
      true,
      'cancelled',
      1,
      { waiting: 0, running: 0, dead: 0 },
      false,
    ]);
  });

  it('register the background jobs again on a worker swapped in for a test', () => {
    const app = createApplication({
      modules: [kernelModule(), billing((builder) => builder.include([CompileStatementsJob]))],
    });

    const swapped = new QueueWorker({
      store: new InMemoryJobStore(),
      clock: new FixedClock(new Date()),
      scope: new AsyncLocalStorageExecutionScope(),
    });

    overrideForTests(app, QueueWorker, swapped);

    expect(swapped.queueNames()).toEqual(['billing']);
  });

  it('let the application go on stopping when the worker fails to stop, and say so', async () => {
    class StuckWorker extends QueueWorker {
      override async stop(): Promise<void> {
        await super.stop();
        throw new Error('stuck');
      }
    }

    const stuck = new StuckWorker({
      store: new InMemoryJobStore(),
      clock: new FixedClock(new Date()),
      scope: new AsyncLocalStorageExecutionScope(),
    });

    const app = createApplication({
      modules: [kernelModule({ queueWorker: stuck }), billing((builder) => builder.include([CompileStatementsJob]))],
    });

    await app.start();

    await expect(app.stop()).rejects.toThrow(AggregateError);
  });
});

describe('the process ports of the kernel module', () => {
  it('run the steps of a process on the store bound, in the test application as in an application', async () => {
    class Dunning {
      static readonly processName = 'billing.dunning';

      static isState(value: unknown): value is { readonly stage: string } {
        return typeof value === 'object' && value !== null && 'stage' in value;
      }
    }

    const app = createTestApplication({ modules: [billing((builder) => builder.include([CompileStatementsJob]))] });

    const real = createApplication({
      modules: [kernelModule(), billing((builder) => builder.include([CompileStatementsJob]))],
    });

    await app.resolve(ProcessRunner).run(Dunning, 'invoice-1', () => ({ state: { stage: 'waiting' } }));
    await real.resolve(ProcessRunner).run(Dunning, 'invoice-1', () => ({ state: { stage: 'waiting' } }));

    expect(app.processes.list()).toMatchObject([{ name: 'billing.dunning', id: 'invoice-1', version: 1 }]);
  });
});

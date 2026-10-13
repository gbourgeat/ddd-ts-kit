import { describe, expect, it } from 'vitest';
import {
  InMemoryUnitOfWork,
  InvalidJobScheduleError,
  backgroundJobPolicy,
  executionContextOfBackgroundJob,
  retryDelayMs,
  whenCommitted,
  type BackgroundJob,
  type BackgroundJobOptions,
} from '../src/index.js';
import { Background, DeclarationError, declarationOf } from '../src/declarations.js';

describe('the options of a background job', () => {
  it('fill in five attempts, an exponential backoff from one second to five minutes and a lease of thirty seconds', () => {
    expect(backgroundJobPolicy()).toEqual({
      maxAttempts: 5,
      backoff: { baseMs: 1_000, factor: 2, maxMs: 300_000 },
      leaseMs: 30_000,
    });
  });

  it('read durations as texts and keep what is written', () => {
    expect(backgroundJobPolicy({ maxAttempts: 2, timeout: '10m', lease: '1m', backoff: { factor: 3 } })).toEqual({
      maxAttempts: 2,
      backoff: { baseMs: 1_000, factor: 3, maxMs: 300_000 },
      leaseMs: 60_000,
      timeoutMs: 600_000,
    });
  });

  it.each<BackgroundJobOptions>([
    { maxAttempts: 0 },
    { maxAttempts: 1.5 },
    { backoff: { factor: 0.5 } },
    { backoff: { baseMs: 10, maxMs: 5 } },
    { lease: '0s' },
  ])('are refused when they are %j', (options) => {
    expect(() => backgroundJobPolicy(options)).toThrow(InvalidJobScheduleError);
  });

  it('wait longer at each retry, never above the cap', () => {
    const policy = backgroundJobPolicy({ backoff: { baseMs: 1_000, factor: 2, maxMs: 5_000 } });

    expect([1, 2, 3, 4].map((attempt) => retryDelayMs(policy, attempt))).toEqual([1_000, 2_000, 4_000, 5_000]);
  });
});

describe('the execution context of a background job', () => {
  it('belongs to the work that enqueued it: its correlation, actor and tenant, the job as the cause', () => {
    const actor = { id: 'user-7', type: 'user' as const, roles: [], attributes: {} };

    const context = executionContextOfBackgroundJob({
      jobId: 'job-1',
      enqueuedBy: { correlationId: 'corr-1', actor, tenantId: 'tenant-3' },
      deadline: new Date('2026-03-02T10:10:00.000Z'),
    });

    expect(context).toMatchObject({
      origin: 'queue',
      correlationId: 'corr-1',
      causationId: 'job-1',
      actor,
      tenantId: 'tenant-3',
      deadline: new Date('2026-03-02T10:10:00.000Z'),
    });
  });
});

describe('a background job declared with @Background', () => {
  it('is recorded under its static jobName, with its options as written', () => {
    class CompileStatementsJob implements BackgroundJob<{ month: string }> {
      static readonly jobName = 'billing.compile-statements';

      async run(): Promise<void> {
        return undefined;
      }
    }

    Background({ maxAttempts: 3 })(CompileStatementsJob);

    expect(declarationOf(CompileStatementsJob)).toMatchObject({
      role: 'background-job',
      name: 'billing.compile-statements',
      options: { maxAttempts: 3 },
    });
  });

  it('is refused without a jobName of the form <context>.<job-name>, or with options it cannot read', () => {
    const declare = (jobName: unknown, options = {}) => {
      class Job implements BackgroundJob<unknown> {
        static readonly jobName = jobName;

        async run(): Promise<void> {
          return undefined;
        }
      }

      Background(options)(Job);
    };

    expect(() => declare('compile')).toThrow(DeclarationError);
    expect(() => declare(undefined)).toThrow(/static jobName/);
    expect(() => declare('billing.compile', { maxAttempts: 0 })).toThrow(/Job "billing.compile": maxAttempts/);
  });
});

describe('a write staged until the commit', () => {
  it('runs after the commit of the unit of work, never when it rolls back, at once outside of one', async () => {
    const written: string[] = [];

    const write = (what: string) => () =>
      whenCommitted(
        async () => void written.push(what),
        () => undefined,
      );

    await new InMemoryUnitOfWork().run(async () => {
      await write('committed')();
      expect(written).toEqual([]);
    });

    await expect(
      new InMemoryUnitOfWork().run(async () => {
        await write('rolled back')();
        throw new Error('refused');
      }),
    ).rejects.toThrow('refused');

    await write('outside')();

    expect(written).toEqual(['committed', 'outside']);
  });

  it('tells who staged it when the write fails, and keeps the commit', async () => {
    const failures: unknown[] = [];
    const down = new Error('store down');

    const result = await new InMemoryUnitOfWork().run(async () => {
      await whenCommitted(
        () => Promise.reject(down),
        (error) => failures.push(error),
      );

      await whenCommitted(
        () => Promise.reject(down),
        () => {
          throw new Error('the observer fails too');
        },
      );

      return 'done';
    });

    await new InMemoryUnitOfWork().run(() => whenCommitted(() => Promise.reject(down)));

    expect(result).toBe('done');
    expect(failures).toEqual([down]);
  });
});

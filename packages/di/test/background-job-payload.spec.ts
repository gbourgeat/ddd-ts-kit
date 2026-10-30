import { describe, expect, it } from 'vitest';
import { err, ok, type BackgroundJob, type BackgroundJobPayloadSchema } from '@ddd-ts-kit/kernel';
import { Background } from '@ddd-ts-kit/kernel/declarations';
import { createApplication, createTestApplication, defineContextModule, type ModuleBuilder } from '../src';
import { wiringFailure } from './support/failure';

interface Statements {
  readonly month: string;
}

/** The schema of the payload since the deploy that named the month. */
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

  async run(payload: Statements): Promise<void> {
    months.push(payload.month);
  }
}

Background()(CompileStatementsJob);

/** The same job as the version before that deploy enqueued it: a year. */
class YearlyStatementsJob implements BackgroundJob<{ readonly year: string }> {
  static readonly jobName = CompileStatementsJob.jobName;

  static readonly payload: BackgroundJobPayloadSchema<{ readonly year: string }> = {
    parse: () => ok({ year: '2026' }),
  };

  async run(): Promise<void> {
    return undefined;
  }
}

/** The job typed loosely, its schema the one of this version: `enqueue` reads the schema. */
class UnsureStatementsJob implements BackgroundJob<{ readonly month: unknown }> {
  static readonly jobName = CompileStatementsJob.jobName;

  static readonly payload: BackgroundJobPayloadSchema<{ readonly month: unknown }> = statements;

  async run(): Promise<void> {
    return undefined;
  }
}

const billing = (register: (builder: ModuleBuilder) => void) => defineContextModule({ name: 'billing', register });

describe('the payload of a background job', () => {
  it('is never run when its schema refuses what the queue kept: the test application throws the reason', async () => {
    const app = createTestApplication({ modules: [billing((builder) => builder.include([CompileStatementsJob]))] });

    await app.jobQueue.enqueue(YearlyStatementsJob, { year: '2026' });

    await expect(app.backgroundJobs.runDue()).rejects.toMatchObject({
      code: 'INVALID_JOB_PAYLOAD',
      job: 'billing.compile-statements',
      issues: [{ path: 'month', code: 'invalid_type' }],
    });

    expect(months).toEqual([]);
    expect(app.backgroundJobs.store.list()).toMatchObject([{ status: 'dead', lastErrorCode: 'INVALID_JOB_PAYLOAD' }]);
  });

  it('is refused where it is enqueued when the schema of this version refuses it, and nothing is stored', async () => {
    const app = createTestApplication({ modules: [billing((builder) => builder.include([CompileStatementsJob]))] });

    await expect(app.jobQueue.enqueue(UnsureStatementsJob, { month: 2026 })).rejects.toMatchObject({
      code: 'INVALID_ENQUEUED_PAYLOAD',
      issues: [{ path: 'month', code: 'invalid_type' }],
    });

    expect(app.backgroundJobs.store.list()).toEqual([]);
  });

  it('is required of a job of an explicit module: a class without its schema is refused', () => {
    class UnreadJob implements BackgroundJob<Statements> {
      static readonly jobName = 'billing.unread';

      static readonly payload = statements;

      async run(): Promise<void> {
        return undefined;
      }
    }

    Reflect.deleteProperty(UnreadJob, 'payload');

    const failure = wiringFailure(() =>
      createApplication({
        modules: [billing((builder) => builder.backgroundJob('billing.unread').handledBy(UnreadJob))],
      }),
    );

    expect(failure).toMatchObject({
      code: 'INVALID_JOB_SETTINGS',
      message: expect.stringMatching(/no payload schema/),
    });
  });

  it('is the schema handed to the factory of a job no class names', async () => {
    const app = createTestApplication({
      modules: [
        billing((builder) =>
          builder
            .backgroundJob('billing.compile-statements')
            .handledByFactory(() => new CompileStatementsJob(), statements),
        ),
      ],
    });

    await app.jobQueue.enqueue(YearlyStatementsJob, { year: '2026' });

    await expect(app.backgroundJobs.runDue()).rejects.toMatchObject({ code: 'INVALID_JOB_PAYLOAD' });
  });
});

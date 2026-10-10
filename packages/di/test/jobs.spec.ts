import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  FixedClock,
  InMemoryEventBus,
  type CommandBus,
  type ExecutionContext,
  type ExecutionScope,
  type IntegrationEventSubscriber,
  type JobDefinition,
  type JobDescription,
  type JobRun,
  type JobScheduler,
  type ScheduledJob,
} from '@ddd-ts-kit/kernel';
import { Scheduled, type ScheduledOptions } from '@ddd-ts-kit/kernel/declarations';
import {
  COMMAND_BUS,
  EXECUTION_SCOPE,
  JOB_SCHEDULER,
  WiringError,
  contextModule,
  createApplication,
  createTestApplication,
  defineContextModule,
  fake,
  kernelModule,
  type BindingInfo,
} from '../src/index.js';
import { discoverContext } from '../src/discovery.js';
import * as billing from './fixtures/contexts/billing/billing.declarations.js';
import { wiringFailure } from './support/failure.js';

const { CUSTOMERS, INVOICES, IssueMonthlyInvoicesJob, InMemoryInvoiceRepository } = billing;
const MONTHLY = 'billing.issue-monthly-invoices';
const billingModule = contextModule('billing', billing);
const everyCustomer = fake(CUSTOMERS, { exists: async () => true });
const anyRun = { outcome: 'succeeded' } as const;

/** The fake of the port: remembers what it was asked, in order, and runs a job on demand. */
class RecordingJobScheduler implements JobScheduler {
  readonly registered: JobDefinition[] = [];

  constructor(private readonly journal: string[] = []) {}

  register(job: JobDefinition): void {
    this.registered.push(job);
  }

  async start(): Promise<void> {
    this.journal.push('jobs started');
  }

  async stop(): Promise<void> {
    this.journal.push('jobs stopped');
  }

  async runNow(name: string): Promise<JobRun> {
    const scheduledAt = new Date(0);
    await this.registered.find((job) => job.name === name)?.run({ scheduledAt, startedAt: scheduledAt, attempt: 1, signal: new AbortController().signal });
    return { job: name, scheduledAt, ...anyRun };
  }

  describe(): readonly JobDescription[] {
    return [];
  }
}

describe('a declared job', () => {
  it('is bound as a singleton of kind job and registered on the job scheduler, with its schedule and the defaults', () => {
    const scheduler = new RecordingJobScheduler();
    const seen: BindingInfo[] = [];

    const app = createApplication({
      modules: [kernelModule({ jobScheduler: scheduler }), billingModule],
      decorate: (instance, info) => {
        seen.push(info);
        return instance;
      },
    });

    expect(scheduler.registered).toMatchObject([
      {
        name: MONTHLY,
        schedule: { cron: '0 6 1 * *', timeZone: 'Europe/Paris' },
        overlap: 'skip',
        missed: 'skip',
        jitterMs: 0,
        enabled: true,
        singleInstance: true,
        timeoutMs: 600_000,
      },
    ]);
    expect(app.describe().bindings).toContainEqual({
      token: 'IssueMonthlyInvoicesJob',
      module: 'billing',
      kind: 'job',
      lifetime: 'singleton',
      source: 'class',
      implementation: 'IssueMonthlyInvoicesJob',
      dependencies: ['kernel.CommandBus'],
      overridden: false,
      origin: 'declared',
      declaredBy: 'IssueMonthlyInvoicesJob',
    });
    expect(seen.filter((info) => info.kind === 'job')).toEqual([]);
  });

  it('is built on its first run, and reaches the decorate hook as a job', async () => {
    const scheduler = new RecordingJobScheduler();
    const kinds: (string | undefined)[] = [];
    const app = createApplication({
      modules: [kernelModule({ jobScheduler: scheduler }), billingModule],
      overrides: [everyCustomer],
      decorate: (instance, info) => {
        kinds.push(info.kind);
        return instance;
      },
    });

    await scheduler.runNow(MONTHLY);

    expect(kinds).toContain('job');
    expect([...(app.resolve(INVOICES) as InstanceType<typeof InMemoryInvoiceRepository>).invoices.values()]).toMatchObject([
      { customerId: 'customer-on-subscription', issuedBy: `system:${MONTHLY}` },
    ]);
  });

  it('is described with the settings it will run with', () => {
    const app = createApplication({ modules: [kernelModule(), billingModule] });

    expect(app.describe().jobs).toEqual([
      {
        name: MONTHLY,
        schedule: 'cron 0 6 1 * * (Europe/Paris)',
        overlap: 'skip',
        missed: 'skip',
        jitterMs: 0,
        enabled: true,
        singleInstance: true,
        timeoutMs: 600_000,
        job: 'IssueMonthlyInvoicesJob',
        module: 'billing',
        origin: 'declared',
        declaredBy: 'IssueMonthlyInvoicesJob',
      },
    ]);
    expect(JSON.parse(JSON.stringify(app.describe()))).toEqual(app.describe());
  });

  it('runs on the in-process scheduler the kernel module binds, on the bound clock, lock and execution scope', async () => {
    const clock = new FixedClock(new Date('2026-03-02T09:58:30.000Z'));
    const app = createApplication({ modules: [kernelModule({ clock }), billingModule], overrides: [everyCustomer] });

    const run = await app.resolve(JOB_SCHEDULER).runNow(MONTHLY);

    expect(run).toMatchObject({ job: MONTHLY, outcome: 'succeeded', scheduledAt: clock.now() });
    expect(app.resolve(JOB_SCHEDULER).describe()).toMatchObject([{ name: MONTHLY, schedule: 'cron 0 6 1 * * (Europe/Paris)', enabled: true }]);
  });

  it('needs a job scheduler: a context listed without the kernel module says so', () => {
    const reminders = defineContextModule({
      name: 'billing',
      register: (builder) => builder.job('billing.send-reminders', { every: '15m' }).handledByFactory(() => ({ run: async () => undefined })),
    });

    const failure = wiringFailure(() => createApplication({ modules: [reminders] }));

    expect(failure.code).toBe('UNBOUND_DEPENDENCY');
    expect(failure.message).toBe('Module "billing" declares the job "billing.send-reminders", but no module binds "kernel.JobScheduler". Add kernelModule() to the modules.');
  });
});

describe('the settings of the application', () => {
  it('switch a job off, change its schedule or any option, by job name, without a code change', () => {
    const scheduler = new RecordingJobScheduler();

    const app = createApplication({
      modules: [kernelModule({ jobScheduler: scheduler }), billingModule],
      jobs: { settings: { [MONTHLY]: { enabled: false, schedule: { every: '6h' }, overlap: 'queue' } } },
    });

    expect(scheduler.registered).toMatchObject([{ name: MONTHLY, schedule: { every: '6h' }, enabled: false, overlap: 'queue', timeoutMs: 600_000 }]);
    expect(app.describe().jobs).toMatchObject([{ name: MONTHLY, schedule: 'every 6h', enabled: false }]);
  });

  it('refuse settings for a job nobody declares: a stale key would leave a renamed job switched on', () => {
    const failure = wiringFailure(() =>
      createApplication({ modules: [kernelModule(), billingModule], jobs: { settings: { 'billing.issue-invoices': { enabled: false } } } }),
    );

    expect(failure.code).toBe('UNKNOWN_JOB');
    expect(failure.message).toBe(`Settings are given for the job "billing.issue-invoices", which no module declares. Declared jobs: "${MONTHLY}".`);
  });

  it.each([
    [{ schedule: { cron: '0 25 * * *' } }, '"25" is not a hour of a cron expression'],
    [{ schedule: { cron: '0 6 * * *', timeZone: 'Europe/Lutece' } }, '"Europe/Lutece" is not a time zone'],
    [{ schedule: { every: 0 } }, '"0" is not a duration'],
    [{ timeoutMs: -1 }, '"-1" is not a duration'],
  ])('refuse settings that cannot be read: %j', (settings, complaint) => {
    const failure = wiringFailure(() => createApplication({ modules: [kernelModule(), billingModule], jobs: { settings: { [MONTHLY]: settings } } }));

    expect(failure.code).toBe('INVALID_JOB_SETTINGS');
    expect(failure.message).toContain(`Job "${MONTHLY}": ${complaint}`);
  });
});

describe('job names', () => {
  class SendReminders implements ScheduledJob {
    async run(): Promise<void> {}
  }

  it('are unique in an application: a second job under a name is refused before anything is built', () => {
    class IssueThemAgain implements ScheduledJob {
      async run(): Promise<void> {}
    }
    Scheduled('billing.issue-monthly-invoices', { every: '1d' })(IssueThemAgain);

    const failure = wiringFailure(() => createApplication({ modules: [kernelModule(), billingModule, contextModule('invoicing', [IssueThemAgain])] }));

    expect(failure.code).toBe('DUPLICATE_JOB');
    expect(failure.message).toContain(
      `Job "${MONTHLY}" is declared twice: in module "billing" (declared by class IssueMonthlyInvoicesJob) and in module "invoicing" (declared by class IssueThemAgain).`,
    );
  });

  it('are checked in an explicit module too, with the schedule', () => {
    const named = (name: string, settings: ScheduledOptions) =>
      defineContextModule({ name: 'billing', register: (builder) => builder.job(name, settings).handledBy(SendReminders) });

    expect(wiringFailure(() => createApplication({ modules: [kernelModule(), named('SendReminders', { every: '15m' })] }))).toMatchObject({
      code: 'INVALID_JOB_SETTINGS',
      message: expect.stringContaining('"SendReminders", declared in module "billing", is not a job name'),
    });
    expect(wiringFailure(() => createApplication({ modules: [kernelModule(), named('billing.send-reminders', { cron: '* * *' })] }))).toMatchObject({
      code: 'INVALID_JOB_SETTINGS',
      message: expect.stringContaining('Cron "* * *" has 3 field(s)'),
    });
  });
});

describe('a job of an explicit module', () => {
  it('is registered like a declared one, and an unfinished statement is refused', async () => {
    let runs = 0;
    const reminders = defineContextModule({
      name: 'billing',
      register(builder) {
        builder.job('billing.send-reminders', { every: '15m', missed: 'run-once' }).handledByFactory(() => ({ run: async () => void (runs += 1) }));
      },
    });
    const app = createTestApplication({ modules: [reminders] });

    await app.jobs.runNow('billing.send-reminders');

    expect(runs).toBe(1);
    expect(app.describe().jobs).toMatchObject([{ name: 'billing.send-reminders', schedule: 'every 15m', missed: 'run-once', module: 'billing' }]);
    expect(app.describe().jobs[0]).not.toHaveProperty('origin');
    expect(
      wiringFailure(() => createApplication({ modules: [kernelModule(), defineContextModule({ name: 'billing', register: (builder) => void builder.job('billing.send-reminders', { every: '15m' }) })] })).message,
    ).toBe('Module "billing" calls job(billing.send-reminders) without handledBy or handledByFactory.');
  });
});

describe('the lifecycle of an application with jobs', () => {
  /** A subscriber and a module that write to the journal when they are used. */
  function journaled() {
    const journal: string[] = [];
    const bus = new InMemoryEventBus();
    const eventSubscriber: IntegrationEventSubscriber = {
      subscribe(type, handler) {
        journal.push('consumers subscribed');
        const subscription = bus.subscribe(type, handler);
        return { unsubscribe: () => (journal.push('consumers unsubscribed'), subscription.unsubscribe()) };
      },
    };
    const platform = defineContextModule({
      name: 'platform',
      register: () => undefined,
      onStart: () => void journal.push('modules started'),
      onStop: () => void journal.push('modules stopped'),
    });
    return { journal, modules: [kernelModule({ eventSubscriber, jobScheduler: new RecordingJobScheduler(journal) }), platform, billingModule] };
  }

  it('starts the jobs last, once the consumers are subscribed, and stops them first', async () => {
    const { journal, modules } = journaled();
    const app = createApplication({ modules });

    await app.start();
    await app.start();
    await app.stop();
    await app.stop();

    expect(journal).toEqual(['modules started', 'consumers subscribed', 'jobs started', 'jobs stopped', 'consumers unsubscribed', 'modules stopped']);
  });

  it('never starts them in a process told not to run jobs, which still registers and describes them', async () => {
    const { journal, modules } = journaled();
    const app = createApplication({ modules, jobs: { start: false } });

    await app.start();
    await app.stop();

    expect(journal).toEqual(['modules started', 'consumers subscribed', 'consumers unsubscribed', 'modules stopped']);
    expect(app.describe().jobs).toHaveLength(1);
  });

  it('leaves the scheduler alone in an application without job', async () => {
    const journal: string[] = [];
    const app = createApplication({ modules: [kernelModule({ jobScheduler: () => (journal.push('scheduler built'), new RecordingJobScheduler(journal)) })] });

    await app.start();
    await app.stop();

    expect(journal).toEqual([]);
    expect(app.describe().jobs).toEqual([]);
  });

  it('reports a scheduler that fails to stop, and still stops the rest', async () => {
    const { journal, modules } = journaled();
    const failing: JobScheduler = Object.assign(new RecordingJobScheduler(journal), { stop: () => Promise.reject(new Error('still running')) });
    const app = createApplication({ modules, overrides: [[JOB_SCHEDULER, failing]] });
    await app.start();

    await expect(app.stop()).rejects.toThrow('1 module(s) failed to stop');
    expect(journal).toEqual(['modules started', 'consumers subscribed', 'jobs started', 'consumers unsubscribed', 'modules stopped']);
  });
});

describe('a job in a test application', () => {
  it('is never started by time: a spec runs it by name and asserts the fakes', async () => {
    const invoices = new InMemoryInvoiceRepository();
    const app = createTestApplication({ modules: [billingModule], fakes: [everyCustomer, fake(INVOICES, invoices)] });
    await app.start();
    app.clock.advance(90 * 24 * 3_600_000);
    expect(invoices.invoices.size).toBe(0);

    const run = await app.jobs.runNow(MONTHLY);

    expect(run).toMatchObject({ job: MONTHLY, outcome: 'succeeded', scheduledAt: app.clock.now() });
    expect([...invoices.invoices.values()]).toMatchObject([{ id: 'id-1', customerId: 'customer-on-subscription', issuedBy: `system:${MONTHLY}` }]);
    expect(app.eventBus.published).toMatchObject([{ type: 'billing.invoice.issued' }]);
  });

  it('runs in the execution scope the scheduler opens, and gives the scope back afterwards', async () => {
    const seen: (ExecutionContext | undefined)[] = [];
    class CloseMonth implements ScheduledJob {
      constructor(private readonly scope: ExecutionScope) {}

      async run(): Promise<void> {
        seen.push(this.scope.current());
      }
    }
    Scheduled('billing.close-month', { every: '1d' }, [EXECUTION_SCOPE])(CloseMonth);
    const app = createTestApplication({ modules: [contextModule('billing', [CloseMonth])] });

    await app.jobs.runNow('billing.close-month');

    expect(seen).toMatchObject([{ origin: 'schedule', actor: { id: 'system:billing.close-month', type: 'system' }, correlationId: 'job-run-1', scheduledAt: app.clock.now() }]);
    expect(app.executionScope.current()).toMatchObject({ origin: 'test', actor: { id: 'test-user' } });
    expect(app.logger.entries).toMatchObject([{ message: 'Scheduled job succeeded', fields: { job: 'billing.close-month' } }]);
  });

  it('throws what the job threw, where the port would only answer a code', async () => {
    const app = createTestApplication({ modules: [billingModule], fakes: [fake(CUSTOMERS, { exists: async () => false })] });

    await expect(app.jobs.runNow(MONTHLY)).rejects.toThrow('Unknown customer customer-on-subscription');
    await expect(app.jobs.scheduler.runNow(MONTHLY)).resolves.toMatchObject({ outcome: 'failed', errorCode: 'UNEXPECTED_ERROR' });
  });

  it('gives a manual scheduler for a spec about time, on the clock of the application', async () => {
    const app = createTestApplication({ modules: [billingModule], fakes: [everyCustomer], now: new Date('2026-03-31T20:00:00.000Z') });
    const before = IssueMonthlyInvoicesJob.executions.length;
    await app.jobs.scheduler.start();

    await app.jobs.scheduler.advance(10 * 3_600_000);

    // The first of April at six in Paris, which is on summer time.
    expect(IssueMonthlyInvoicesJob.executions.slice(before)).toMatchObject([{ scheduledAt: new Date('2026-04-01T04:00:00.000Z') }]);
    expect(app.clock.now()).toEqual(new Date('2026-04-01T06:00:00.000Z'));
    await app.jobs.scheduler.stop();
  });

  it('takes the settings of a configuration, like an application', async () => {
    const app = createTestApplication({ modules: [billingModule], fakes: [everyCustomer], jobs: { [MONTHLY]: { enabled: false } } });

    expect(app.describe().jobs).toMatchObject([{ name: MONTHLY, enabled: false }]);
    expect(app.get(COMMAND_BUS) satisfies CommandBus).toBe(app.commandBus);
  });
});

describe('a discovered job', () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'discovered-jobs-'));

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  function contextWith(file: string): string {
    const directory = mkdtempSync(path.join(workspace, 'context-'));
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    writeFileSync(path.join(directory, file), '');
    return directory;
  }

  async function failureOf(work: Promise<unknown>): Promise<WiringError> {
    const outcome = await work.then(
      () => undefined,
      (error: unknown) => error,
    );
    if (!(outcome instanceof WiringError)) throw new Error(`Expected a WiringError, got ${String(outcome)}`);
    return outcome;
  }

  it('is a *.job file of application/scheduling/', async () => {
    const directory = contextWith('application/scheduling/issue-monthly-invoices.job.mjs');

    const module = await discoverContext('billing', directory, { load: async () => ({ IssueMonthlyInvoicesJob }) });

    expect(createApplication({ modules: [kernelModule(), module] }).describe().jobs).toMatchObject([
      { name: MONTHLY, file: path.join(directory, 'application/scheduling/issue-monthly-invoices.job.mjs') },
    ]);
  });

  it('is refused outside its folder, and so is another role in a *.job file', async () => {
    const misplaced = await failureOf(discoverContext('billing', contextWith('application/commands/issue-monthly-invoices.job.mjs')));
    const directory = contextWith('application/scheduling/issue-monthly-invoices.job.mjs');
    const wrongRole = await failureOf(discoverContext('billing', directory, { load: async () => ({ InMemoryInvoiceRepository }) }));

    expect(misplaced).toMatchObject({
      code: 'MISPLACED_DECLARATION',
      message: 'application/commands/issue-monthly-invoices.job.mjs of context "billing" is outside its canonical folder: a *.job file belongs in application/scheduling/.',
    });
    expect(wrongRole.code).toBe('MISPLACED_DECLARATION');
    expect(wrongRole.message).toContain('a *.job file: that suffix is for job.');
  });
});

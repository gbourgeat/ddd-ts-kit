import { describe, expect, it } from 'vitest';
import { FixedClock, JobScheduler, type ScheduledJob } from '@ddd-ts-kit/kernel';
import { Scheduled, type ScheduledOptions } from '@ddd-ts-kit/kernel/declarations';
import {
  contextModule,
  createApplication,
  createTestApplication,
  defineContextModule,
  fake,
  kernelModule,
  override,
  type BindingInfo,
} from '../src/index.js';
import * as billing from './fixtures/contexts/billing/billing.declarations.js';
import { RecordingJobScheduler } from './support/fakes/recording-job-scheduler.js';
import { wiringFailure } from './support/failure.js';

const { CustomerDirectory, InMemoryInvoiceRepository, InvoiceRepository } = billing;
const MONTHLY = 'billing.issue-monthly-invoices';
const billingModule = contextModule('billing', billing);
const everyCustomer = fake(CustomerDirectory, { exists: async () => true });

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
      dependencies: ['CommandBus'],
      overridden: false,
      origin: 'declared',
      declaredBy: 'IssueMonthlyInvoicesJob',
    });

    expect(seen.filter((info) => info.kind === 'job')).toEqual([]);
  });

  it('is built on its first run, and reaches the decorate hook as a job', async () => {
    const scheduler = new RecordingJobScheduler();
    const invoices = new InMemoryInvoiceRepository();
    const kinds: (string | undefined)[] = [];

    createApplication({
      modules: [kernelModule({ jobScheduler: scheduler }), billingModule],
      overrides: [everyCustomer, override(InvoiceRepository, invoices)],
      decorate: (instance, info) => {
        kinds.push(info.kind);

        return instance;
      },
    });

    expect(kinds).not.toContain('job');
    await scheduler.runNow(MONTHLY);

    expect(kinds).toContain('job');

    expect([...invoices.invoices.values()]).toMatchObject([
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
});

describe('the scheduler of a declared job', () => {
  it('runs on the in-process scheduler the kernel module binds, on the bound clock, lock and execution scope', async () => {
    const clock = new FixedClock(new Date('2026-03-02T09:58:30.000Z'));
    const app = createApplication({ modules: [kernelModule({ clock }), billingModule], overrides: [everyCustomer] });

    const run = await app.resolve(JobScheduler).runNow(MONTHLY);

    expect(run).toMatchObject({ job: MONTHLY, outcome: 'succeeded', scheduledAt: clock.now() });

    expect(app.resolve(JobScheduler).describe()).toMatchObject([
      { name: MONTHLY, schedule: 'cron 0 6 1 * * (Europe/Paris)', enabled: true },
    ]);
  });

  it('needs a job scheduler: a context listed without the kernel module says so', () => {
    const reminders = defineContextModule({
      name: 'billing',
      register: (builder) =>
        builder
          .job('billing.send-reminders', { every: '15m' })
          .handledByFactory(() => ({ run: async () => undefined })),
    });

    const failure = wiringFailure(() => createApplication({ modules: [reminders] }));

    expect(failure.code).toBe('UNBOUND_DEPENDENCY');

    expect(failure.message).toBe(
      'Module "billing" declares the job "billing.send-reminders", but no module binds "JobScheduler". Add kernelModule() to the modules.',
    );
  });
});

describe('the settings of the application', () => {
  it('switch a job off, change its schedule or any option, by job name, without a code change', () => {
    const scheduler = new RecordingJobScheduler();

    const app = createApplication({
      modules: [kernelModule({ jobScheduler: scheduler }), billingModule],
      jobs: { settings: { [MONTHLY]: { enabled: false, schedule: { every: '6h' }, overlap: 'queue' } } },
    });

    expect(scheduler.registered).toMatchObject([
      { name: MONTHLY, schedule: { every: '6h' }, enabled: false, overlap: 'queue', timeoutMs: 600_000 },
    ]);

    expect(app.describe().jobs).toMatchObject([{ name: MONTHLY, schedule: 'every 6h', enabled: false }]);
  });

  it('refuse settings for a job nobody declares: a stale key would leave a renamed job switched on', () => {
    const failure = wiringFailure(() =>
      createApplication({
        modules: [kernelModule(), billingModule],
        jobs: { settings: { 'billing.issue-invoices': { enabled: false } } },
      }),
    );

    expect(failure.code).toBe('UNKNOWN_JOB');

    expect(failure.message).toBe(
      `Settings are given for the job "billing.issue-invoices", which no module declares. Declared jobs: "${MONTHLY}".`,
    );
  });

  it.each([
    [{ schedule: { cron: '0 25 * * *' } }, '"25" is not a hour of a cron expression'],
    [{ schedule: { cron: '0 6 * * *', timeZone: 'Europe/Lutece' } }, '"Europe/Lutece" is not a time zone'],
    [{ schedule: { every: 0 } }, '"0" is not a duration'],
    [{ timeoutMs: -1 }, '"-1" is not a duration'],
  ])('refuse settings that cannot be read: %j', (settings, complaint) => {
    const failure = wiringFailure(() =>
      createApplication({ modules: [kernelModule(), billingModule], jobs: { settings: { [MONTHLY]: settings } } }),
    );

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

    const failure = wiringFailure(() =>
      createApplication({ modules: [kernelModule(), billingModule, contextModule('invoicing', [IssueThemAgain])] }),
    );

    expect(failure.code).toBe('DUPLICATE_JOB');

    expect(failure.message).toContain(
      `Job "${MONTHLY}" is declared twice: in module "billing" (declared by class IssueMonthlyInvoicesJob) and in module "invoicing" (declared by class IssueThemAgain).`,
    );
  });

  it('are checked before the class bound twice: the same job class listed in two modules is a job declared twice', () => {
    const { IssueMonthlyInvoicesJob } = billing;

    const failure = wiringFailure(() =>
      createApplication({
        modules: [kernelModule(), billingModule, contextModule('invoicing', [IssueMonthlyInvoicesJob])],
      }),
    );

    expect(failure.code).toBe('DUPLICATE_JOB');
  });

  it('are checked in an explicit module too, with the schedule', () => {
    const named = (name: string, settings: ScheduledOptions) =>
      defineContextModule({
        name: 'billing',
        register: (builder) => builder.job(name, settings).handledBy(SendReminders),
      });

    expect(
      wiringFailure(() => createApplication({ modules: [kernelModule(), named('SendReminders', { every: '15m' })] })),
    ).toMatchObject({
      code: 'INVALID_JOB_SETTINGS',
      message: expect.stringContaining('"SendReminders", declared in module "billing", is not a job name'),
    });

    expect(
      wiringFailure(() =>
        createApplication({ modules: [kernelModule(), named('billing.send-reminders', { cron: '* * *' })] }),
      ),
    ).toMatchObject({
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
        builder
          .job('billing.send-reminders', { every: '15m', missed: 'run-once' })
          .handledByFactory(() => ({ run: async () => void (runs += 1) }));
      },
    });

    const app = createTestApplication({ modules: [reminders] });

    await app.jobs.runNow('billing.send-reminders');

    expect(runs).toBe(1);

    expect(app.describe().jobs).toMatchObject([
      { name: 'billing.send-reminders', schedule: 'every 15m', missed: 'run-once', module: 'billing' },
    ]);

    expect(app.describe().jobs[0]).not.toHaveProperty('origin');

    expect(
      wiringFailure(() =>
        createApplication({
          modules: [
            kernelModule(),
            defineContextModule({
              name: 'billing',
              register: (builder) => void builder.job('billing.send-reminders', { every: '15m' }),
            }),
          ],
        }),
      ).message,
    ).toBe('Module "billing" calls job(billing.send-reminders) without handledBy or handledByFactory.');
  });
});

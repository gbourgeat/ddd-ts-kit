import { describe, expect, it } from 'vitest';
import {
  CommandBus,
  ExecutionScope,
  InMemoryEventBus,
  JobScheduler,
  type ExecutionContext,
  type IntegrationEventSubscriber,
  type ScheduledJob,
} from '@ddd-ts-kit/kernel';
import { Scheduled } from '@ddd-ts-kit/kernel/declarations';
import { contextModule, defineContextModule, fake, kernelModule, override } from '../src';
import { createApplication, createTestApplication } from './support/on-container';
import * as billing from './fixtures/contexts/billing/billing.declarations';
import { RecordingJobScheduler } from './support/fakes/recording-job-scheduler';

const { CustomerDirectory, InvoiceRepository, IssueMonthlyInvoicesJob, InMemoryInvoiceRepository } = billing;
const MONTHLY = 'billing.issue-monthly-invoices';
const billingModule = contextModule('billing', billing);
const everyCustomer = fake(CustomerDirectory, { exists: async () => true });

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

    return {
      journal,
      modules: [
        kernelModule({ eventSubscriber, jobScheduler: new RecordingJobScheduler(journal) }),
        platform,
        billingModule,
      ],
    };
  }

  it('starts the jobs last, once the consumers are subscribed, and stops them first', async () => {
    const { journal, modules } = journaled();
    const app = createApplication({ modules });

    await app.start();
    await app.start();
    await app.stop();
    await app.stop();

    expect(journal).toEqual([
      'modules started',
      'consumers subscribed',
      'jobs started',
      'jobs stopped',
      'consumers unsubscribed',
      'modules stopped',
    ]);
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

    const app = createApplication({
      modules: [
        kernelModule({ jobScheduler: () => (journal.push('scheduler built'), new RecordingJobScheduler(journal)) }),
      ],
    });

    await app.start();
    await app.stop();

    expect(journal).toEqual([]);
    expect(app.describe().jobs).toEqual([]);
  });

  it('reports a scheduler that fails to stop, and still stops the rest', async () => {
    const { journal, modules } = journaled();

    const failing: JobScheduler = Object.assign(new RecordingJobScheduler(journal), {
      stop: () => Promise.reject(new Error('still running')),
    });

    const app = createApplication({ modules, overrides: [override(JobScheduler, failing)] });

    await app.start();

    await expect(app.stop()).rejects.toThrow('1 module(s) failed to stop');

    expect(journal).toEqual([
      'modules started',
      'consumers subscribed',
      'jobs started',
      'consumers unsubscribed',
      'modules stopped',
    ]);
  });
});

describe('a job in a test application', () => {
  it('is never started by time: a spec runs it by name and asserts the fakes', async () => {
    const invoices = new InMemoryInvoiceRepository();

    const app = createTestApplication({
      modules: [billingModule],
      fakes: [everyCustomer, fake(InvoiceRepository, invoices)],
    });

    await app.start();
    app.clock.advance(90 * 24 * 3_600_000);
    expect(invoices.invoices.size).toBe(0);

    const run = await app.jobs.runNow(MONTHLY);

    expect(run).toMatchObject({ job: MONTHLY, outcome: 'succeeded', scheduledAt: app.clock.now() });

    expect([...invoices.invoices.values()]).toMatchObject([
      { id: 'id-1', customerId: 'customer-on-subscription', issuedBy: `system:${MONTHLY}` },
    ]);

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
    Scheduled('billing.close-month', { every: '1d' }, [ExecutionScope])(CloseMonth);
    const app = createTestApplication({ modules: [contextModule('billing', [CloseMonth])] });

    await app.jobs.runNow('billing.close-month');

    expect(seen).toMatchObject([
      {
        origin: 'schedule',
        actor: { id: 'system:billing.close-month', type: 'system' },
        correlationId: 'job-run-1',
        scheduledAt: app.clock.now(),
      },
    ]);

    expect(app.executionScope.current()).toMatchObject({ origin: 'test', actor: { id: 'test-user' } });

    expect(app.logger.entries).toMatchObject([
      { message: 'Scheduled job succeeded', fields: { job: 'billing.close-month' } },
    ]);
  });

  it('throws what the job threw, where the port would only answer a code', async () => {
    const app = createTestApplication({
      modules: [billingModule],
      fakes: [fake(CustomerDirectory, { exists: async () => false })],
    });

    await expect(app.jobs.runNow(MONTHLY)).rejects.toThrow('Unknown customer customer-on-subscription');

    await expect(app.jobs.scheduler.runNow(MONTHLY)).resolves.toMatchObject({
      outcome: 'failed',
      errorCode: 'UNEXPECTED_ERROR',
    });
  });

  it('gives a manual scheduler for a spec about time, on the clock of the application', async () => {
    const app = createTestApplication({
      modules: [billingModule],
      fakes: [everyCustomer],
      now: new Date('2026-03-31T20:00:00.000Z'),
    });

    const before = IssueMonthlyInvoicesJob.executions.length;

    await app.jobs.scheduler.start();

    await app.jobs.scheduler.advance(10 * 3_600_000);

    // The first of April at six in Paris, which is on summer time.
    expect(IssueMonthlyInvoicesJob.executions.slice(before)).toMatchObject([
      { scheduledAt: new Date('2026-04-01T04:00:00.000Z') },
    ]);

    expect(app.clock.now()).toEqual(new Date('2026-04-01T06:00:00.000Z'));
    await app.jobs.scheduler.stop();
  });

  it('takes the settings of a configuration, like an application', async () => {
    const app = createTestApplication({
      modules: [billingModule],
      fakes: [everyCustomer],
      jobs: { [MONTHLY]: { enabled: false } },
    });

    expect(app.describe().jobs).toMatchObject([{ name: MONTHLY, enabled: false }]);
    expect(app.get(CommandBus) satisfies CommandBus).toBe(app.commandBus);
  });
});

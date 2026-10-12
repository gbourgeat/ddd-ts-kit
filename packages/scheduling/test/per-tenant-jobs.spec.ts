import { describe, expect, it } from 'vitest';
import { InMemoryTenantDirectory, InvalidJobScheduleError, type JobExecution } from '@ddd-ts-kit/kernel';
import { aBench } from './support/a-bench.js';
import { LedgerClosed } from './support/ledger-closed.js';
import { MINUTE } from './support/durations.js';
import { REMINDERS } from './support/job-names.js';
import { QUARTERLY } from './support/quarterly.js';
import { refuseUnhandledRejections } from './support/refuse-unhandled-rejections.js';

refuseUnhandledRejections();

describe('a job declared per tenant', () => {
  it('runs once per tenant of the directory, each run in that tenant', async () => {
    const { scheduler, scope } = aBench({ tenants: new InMemoryTenantDirectory(['acme', 'globex']) });
    const seen: { told: string | undefined; scoped: string | undefined; correlation: string }[] = [];

    scheduler.register({
      name: REMINDERS,
      schedule: QUARTERLY,
      tenancy: 'per-tenant',
      run: async (execution: JobExecution) => {
        const context = scope.require();

        seen.push({ told: execution.tenantId, scoped: context.tenantId, correlation: context.correlationId });
      },
    });

    await scheduler.runNow(REMINDERS);

    expect(seen).toEqual([
      { told: 'acme', scoped: 'acme', correlation: 'run-1' },
      { told: 'globex', scoped: 'globex', correlation: 'run-1' },
    ]);

    expect(scheduler.runs.map((run) => run.outcome)).toEqual(['succeeded']);
  });

  it('gives every tenant its run when one fails, then fails the occurrence with that error', async () => {
    const { scheduler } = aBench({ tenants: new InMemoryTenantDirectory(['acme', 'globex', 'initech']) });
    const ran: string[] = [];

    scheduler.register({
      name: REMINDERS,
      schedule: QUARTERLY,
      tenancy: 'per-tenant',
      run: async ({ tenantId = 'none' }) => {
        ran.push(tenantId);

        if (tenantId === 'globex') {
          throw new LedgerClosed('closed');
        }
      },
    });

    await scheduler.start();
    await scheduler.advance(2 * MINUTE);

    expect(ran).toEqual(['acme', 'globex', 'initech']);
    expect(scheduler.runs).toMatchObject([{ outcome: 'failed', errorCode: 'LEDGER_CLOSED' }]);
  });

  it('stops before the next tenant once its run is aborted', async () => {
    const { scheduler } = aBench({ tenants: new InMemoryTenantDirectory(['acme', 'globex']) });
    const ran: string[] = [];

    scheduler.register({
      name: REMINDERS,
      schedule: QUARTERLY,
      tenancy: 'per-tenant',
      timeoutMs: 1_000,
      run: async ({ tenantId = 'none' }) => {
        ran.push(tenantId);
        await scheduler.advance(2_000);
      },
    });

    await scheduler.runNow(REMINDERS);

    expect(ran).toEqual(['acme']);
    expect(scheduler.runs).toMatchObject([{ outcome: 'failed', errorCode: 'JOB_TIMEOUT' }]);
  });

  it('is refused by a scheduler that knows no tenants, while a global job runs in none', async () => {
    const { scheduler, scope } = aBench();
    let tenant: string | undefined = 'unset';

    expect(() =>
      scheduler.register({ name: REMINDERS, schedule: QUARTERLY, tenancy: 'per-tenant', run: async () => undefined }),
    ).toThrow(InvalidJobScheduleError);

    scheduler.register({
      name: REMINDERS,
      schedule: QUARTERLY,
      run: async () => {
        tenant = scope.require().tenantId;
      },
    });

    await scheduler.runNow(REMINDERS);

    expect(tenant).toBeUndefined();
  });
});

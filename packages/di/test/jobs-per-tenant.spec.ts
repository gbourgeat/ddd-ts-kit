import { describe, expect, it } from 'vitest';
import {
  ExecutionScope,
  InMemoryTenantDirectory,
  InvalidJobScheduleError,
  JobScheduler,
  TenantDirectory,
  type Actor,
  type ScheduledJob,
} from '@ddd-ts-kit/kernel';
import { Scheduled } from '@ddd-ts-kit/kernel/declarations';
import { contextModule, createApplication, createTestApplication, kernelModule } from '../src/index.js';

/** A job that notes the tenant of each of its runs. */
function tenantsJob(seen: (string | undefined)[]): new (scope: ExecutionScope) => ScheduledJob {
  class CloseTheDay implements ScheduledJob {
    constructor(private readonly scope: ExecutionScope) {}

    async run(): Promise<void> {
      seen.push(this.scope.current()?.tenantId);
    }
  }

  Scheduled('desk.close-the-day', { every: '1d', tenancy: 'per-tenant' }, [ExecutionScope])(CloseTheDay);

  return CloseTheDay;
}

describe('a job that runs per tenant on the default scheduler', () => {
  it('runs once in each tenant the kernel module names, and the directory is bound for the rest', async () => {
    const seen: (string | undefined)[] = [];
    const tenants = new InMemoryTenantDirectory(['north', 'south']);

    const app = createApplication({
      modules: [kernelModule({ tenants }), contextModule('desk', [tenantsJob(seen)])],
    });

    await app.resolve(JobScheduler).runNow('desk.close-the-day');

    expect(seen).toEqual(['north', 'south']);
    expect(app.resolve(TenantDirectory)).toBe(tenants);
  });

  it('is refused when it is registered, and no directory is bound, when the kernel module names no tenants', () => {
    const composing = () => createApplication({ modules: [kernelModule(), contextModule('desk', [tenantsJob([])])] });

    expect(composing).toThrow(InvalidJobScheduleError);
  });
});

describe('a job that runs per tenant in a test application', () => {
  it('runs for the tenants the spec names, or else for the tenant of its execution context', async () => {
    const named: (string | undefined)[] = [];
    const ofTheActor: (string | undefined)[] = [];
    const actor: Actor = { id: 'clerk', type: 'user', tenantId: 'east', roles: [], attributes: {} };

    await createTestApplication({
      modules: [contextModule('desk', [tenantsJob(named)])],
      tenants: ['north', 'south'],
    }).jobs.runNow('desk.close-the-day');

    await createTestApplication({ modules: [contextModule('desk', [tenantsJob(ofTheActor)])], actor }).jobs.runNow(
      'desk.close-the-day',
    );

    expect(named).toEqual(['north', 'south']);
    expect(ofTheActor).toEqual(['east']);
  });

  it('composes when neither the spec nor its execution context names a tenant, and then runs for none', async () => {
    const seen: (string | undefined)[] = [];
    const application = createTestApplication({ modules: [contextModule('desk', [tenantsJob(seen)])] });

    await application.jobs.runNow('desk.close-the-day');

    expect(seen).toEqual([]);
  });
});

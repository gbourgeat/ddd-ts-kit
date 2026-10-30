import { describe, expect, it } from 'vitest';
import {
  acrossTenants,
  executionContext,
  NoCurrentTenantError,
  SequentialIdGenerator,
  systemActor,
  type Actor,
  type AuditRecord,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';
import { aQueueBench } from './support/a-queue-bench';
import { CompileStatementsJob } from './support/statements-job';

const FEBRUARY = { month: '2026-02', customers: ['c-1'] };

function memberOf(tenantId: string): ExecutionContext {
  const actor: Actor = { id: `accountant-of-${tenantId}`, type: 'user', tenantId, roles: [], attributes: {} };

  return executionContext({ correlationId: `corr-${tenantId}`, actor, origin: 'http' });
}

function staffOver(tenants: readonly string[]): ExecutionContext {
  const actor: Actor = { id: 'staff-1', type: 'user', roles: [], attributes: {} };

  return executionContext({
    correlationId: 'corr-staff',
    actor,
    origin: 'http',
    elevation: { reason: 'SUPPORT', tenants },
  });
}

/** A caller who signed in but names no tenant, a global job... */
function noTenant(): ExecutionContext {
  const actor: Actor = { id: 'visitor-1', type: 'user', roles: [], attributes: {} };

  return executionContext({ correlationId: 'corr-none', actor, origin: 'http' });
}

describe('the jobs of a tenant', () => {
  it('are found and cancelled by the work of that tenant only', async () => {
    const { queue, scope } = aQueueBench();
    const acme = memberOf('acme');
    const globex = memberOf('globex');

    await scope.run(acme, () => queue.enqueue(CompileStatementsJob, FEBRUARY, { subject: 'ledger-1' }));

    expect(await scope.run(globex, () => queue.find('job-1'))).toBe(undefined);
    expect(await scope.run(globex, () => queue.cancel('job-1'))).toBe(false);
    expect(await scope.run(acme, () => queue.find('job-1'))).toMatchObject({ tenantId: 'acme', subject: 'ledger-1' });
    expect(await scope.run(acme, () => queue.cancel('job-1'))).toBe(true);
  });

  it('keep their idempotency keys apart from another tenant', async () => {
    const { queue, scope } = aQueueBench();
    const options = { idempotencyKey: 'feb' };

    const first = await scope.run(memberOf('acme'), () => queue.enqueue(CompileStatementsJob, FEBRUARY, options));
    const second = await scope.run(memberOf('globex'), () => queue.enqueue(CompileStatementsJob, FEBRUARY, options));

    expect([first, second]).toEqual([
      { id: 'job-1', duplicate: false },
      { id: 'job-2', duplicate: false },
    ]);
  });

  it('are reached by an elevation over that tenant, and by work without a tenant in a project without tenancy', async () => {
    const { queue, scope } = aQueueBench();

    await scope.run(memberOf('acme'), () => queue.enqueue(CompileStatementsJob, FEBRUARY));

    expect(await scope.run(staffOver(['globex']), () => queue.find('job-1'))).toBe(undefined);
    expect((await scope.run(staffOver(['acme']), () => queue.find('job-1')))?.id).toBe('job-1');
    expect((await queue.find('job-1'))?.id).toBe('job-1');
  });
});

describe('the jobs of a multi-tenant project', () => {
  it('are refused to work that names no tenant, before the store is read', async () => {
    const { queue, scope, store } = aQueueBench({ tenant: true });

    await scope.run(memberOf('acme'), () => queue.enqueue(CompileStatementsJob, FEBRUARY));

    await expect(scope.run(noTenant(), () => queue.find('job-1'))).rejects.toBeInstanceOf(NoCurrentTenantError);
    await expect(scope.run(noTenant(), () => queue.cancel('job-1'))).rejects.toBeInstanceOf(NoCurrentTenantError);
    await expect(queue.find('job-1')).rejects.toBeInstanceOf(NoCurrentTenantError);
    await expect(queue.cancel('job-1')).rejects.toBeInstanceOf(NoCurrentTenantError);

    expect(store.finds).toBe(0);
  });

  it('stay with their tenant', async () => {
    const { queue, scope } = aQueueBench({ tenant: true });

    await scope.run(memberOf('acme'), () => queue.enqueue(CompileStatementsJob, FEBRUARY));

    expect(await scope.run(memberOf('globex'), () => queue.find('job-1'))).toBe(undefined);
    expect((await scope.run(memberOf('acme'), () => queue.find('job-1')))?.id).toBe('job-1');
  });

  it('are reached by a system job through an elevation, recorded in the trail', async () => {
    const { clock, queue, scope } = aQueueBench({ tenant: true });
    const recorded: AuditRecord[] = [];
    const trail = { record: async (entry: AuditRecord) => void recorded.push(entry) };
    const options = { scope, trail, clock, ids: new SequentialIdGenerator('audit') };
    const nightly = executionContext({ correlationId: 'nightly', actor: systemActor('nightly'), origin: 'schedule' });

    await scope.run(memberOf('acme'), () => queue.enqueue(CompileStatementsJob, FEBRUARY));

    const job = await scope.run(nightly, () =>
      acrossTenants(options, { reason: 'NIGHTLY_SWEEP', tenants: ['acme'] }, () => queue.find('job-1')),
    );

    expect(job?.tenantId).toBe('acme');
    expect(recorded.map(({ reason }) => reason)).toEqual(['NIGHTLY_SWEEP']);
  });

  it('still take a job from work that names no tenant, which runs in none', async () => {
    const { queue, scope } = aQueueBench({ tenant: true });

    const enqueued = await scope.run(noTenant(), () => queue.enqueue(CompileStatementsJob, FEBRUARY));

    expect(enqueued).toEqual({ id: 'job-1', duplicate: false });
  });
});

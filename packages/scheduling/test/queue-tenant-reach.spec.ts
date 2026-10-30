import { describe, expect, it } from 'vitest';
import { executionContext, type Actor, type ExecutionContext } from '@ddd-ts-kit/kernel';
import { jobsOfSubject } from '../src';
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

  it('are reached by an elevation over that tenant, and by work without a tenant', async () => {
    const { queue, scope } = aQueueBench();

    await scope.run(memberOf('acme'), () => queue.enqueue(CompileStatementsJob, FEBRUARY));

    expect(await scope.run(staffOver(['globex']), () => queue.find('job-1'))).toBe(undefined);
    expect((await scope.run(staffOver(['acme']), () => queue.find('job-1')))?.id).toBe('job-1');
    expect((await queue.find('job-1'))?.id).toBe('job-1');
  });
});

describe('the jobs of a person', () => {
  it('are one copy of that person: named by their subject, dropped once, whichever tenant enqueued them', async () => {
    const { queue, scope, store, clock } = aQueueBench();
    const options = { subject: 'cus-1' };

    await scope.run(memberOf('acme'), () => queue.enqueue(CompileStatementsJob, FEBRUARY, options));
    await scope.run(memberOf('globex'), () => queue.enqueue(CompileStatementsJob, FEBRUARY, options));
    await scope.run(memberOf('acme'), () => queue.enqueue(CompileStatementsJob, FEBRUARY, { subject: 'cus-2' }));

    const copy = jobsOfSubject(store);

    expect(copy.name).toBe('platform.background-jobs');
    expect(await copy.erase('cus-1')).toBe(2);

    const left = await store.claim({ queue: 'billing', limit: 10, now: clock.now(), leaseMs: 1 });

    expect(left.map(({ id }) => id)).toEqual(['job-3']);
  });
});

import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator, anonymousActor, executionContext, type Actor } from '@ddd-ts-kit/kernel';
import { InMemoryAuditTrail, auditGuardRefusals } from '../src/index.js';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} };

describe('auditGuardRefusals', () => {
  it('records a request refused at the edge as a denied decision of its route', async () => {
    const trail = new InMemoryAuditTrail();

    const record = auditGuardRefusals(trail, {
      clock: new FixedClock(new Date('2026-03-01T10:00:00.000Z')),
      ids: new SequentialIdGenerator('audit'),
    });

    const execution = executionContext({ correlationId: 'corr-1', actor: ada, origin: 'http' });

    await record({ operationId: 'listInvoices', problem: { status: 403, code: 'FORBIDDEN' }, execution });
    await record({ operationId: 'listInvoices', problem: { status: 401 }, execution });

    expect(trail.entries).toMatchObject([
      {
        category: 'authorization',
        action: 'http:listInvoices',
        outcome: 'denied',
        reason: 'FORBIDDEN',
        actor: { id: 'ada', type: 'user', tenantId: 'acme' },
        tenantId: 'acme',
        correlationId: 'corr-1',
        origin: 'http',
      },
      { reason: 'UNAUTHORIZED' },
    ]);
  });

  it('records nothing for a caller without a credential, whatever tenant it addressed', async () => {
    const trail = new InMemoryAuditTrail();

    const record = auditGuardRefusals(trail, {
      clock: new FixedClock(new Date(0)),
      ids: new SequentialIdGenerator('a'),
    });

    for (const tenantId of ['acme', 'tenant-0', 'tenant-1']) {
      const execution = executionContext({ correlationId: 'c', actor: anonymousActor(), origin: 'http', tenantId });

      await record({ operationId: 'listInvoices', problem: { status: 401, code: 'UNAUTHORIZED' }, execution });
    }

    expect(trail.entries).toEqual([]);
  });
});

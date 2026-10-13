import { describe, expect, it } from 'vitest';
import { AsyncLocalStorageExecutionScope, NoCurrentTenantError, type AuditRecord } from '@ddd-ts-kit/kernel';
import { anExecutionContext, asTenant, scoped } from '@ddd-ts-kit/testing';
import { InMemoryAuditTrail, TenantAuditReader } from '../src/index.js';

const scope = new AsyncLocalStorageExecutionScope();
const page = { kind: 'offset', offset: 0, limit: 10, sort: [] } as const;

function recordOf(id: string, tenantId?: string): AuditRecord {
  return {
    id,
    occurredAt: new Date(0),
    category: 'command',
    action: 'billing.issue-invoice',
    outcome: 'succeeded',
    actor: { id: 'ada', type: 'user' },
    correlationId: 'c',
    origin: 'http',
    ...(tenantId === undefined ? {} : { tenantId }),
  };
}

async function aTrail(): Promise<InMemoryAuditTrail> {
  const trail = new InMemoryAuditTrail();

  await trail.record(recordOf('a1', 'acme'));
  await trail.record(recordOf('g1', 'globex'));
  await trail.record(recordOf('p1'));

  return trail;
}

describe('TenantAuditReader', () => {
  it('confines a search to the tenant of the work, whatever the filter names', async () => {
    const reader = new TenantAuditReader(await aTrail(), scope);

    const ids = async (filter: object) =>
      (await asTenant(scope, 'acme', () => reader.search(filter, page))).items.map((entry) => entry.id);

    expect(await ids({})).toEqual(['a1']);
    expect(await ids({ tenantId: 'globex' })).toEqual([]);
    expect(await ids({ chain: 'global' })).toEqual([]);
    expect(await ids({ chain: 'tenant:acme' })).toEqual(['a1']);
  });

  it('reads across tenants under an elevation only, and refuses work that names no tenant', async () => {
    const reader = new TenantAuditReader(await aTrail(), scope);
    const staff = anExecutionContext();

    const ids = async (tenants: 'all' | readonly string[], filter: object) =>
      (await scoped(scope, staff.elevatedOver(tenants), () => reader.search(filter, page))).items.map(
        (entry) => entry.id,
      );

    expect((await ids('all', {})).sort()).toEqual(['a1', 'g1', 'p1']);
    expect(await ids(['globex'], { tenantId: 'globex' })).toEqual(['g1']);
    expect(await ids(['globex'], { tenantId: 'acme' })).toEqual([]);
    expect(await ids(['globex'], {})).toEqual([]);
    await expect(scoped(scope, staff, () => reader.search({}, page))).rejects.toThrow(NoCurrentTenantError);
  });
});

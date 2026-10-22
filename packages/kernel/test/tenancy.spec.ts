import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  InMemoryTenantDirectory,
  InvalidTenantElevationError,
  NoCurrentTenantError,
  SequentialIdGenerator,
  TENANT_ELEVATION_ACTION,
  acrossTenants,
  executionContext,
  executionContextOfJob,
  isTenantMember,
  logFieldsOf,
  tenantCacheKey,
  tenantKey,
  tenantReachOf,
  tenantScopeOf,
  tenantsOf,
  type Actor,
  type AuditRecord,
  type AuditTrail,
  type ElevationOptions,
  type Session,
} from '../src';

const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: [], attributes: {} };
const consultant: Actor = { id: 'cy', type: 'user', tenantId: 'acme', roles: [], attributes: { tenants: ['globex'] } };
const staff: Actor = { id: 'sam', type: 'user', roles: ['support'], attributes: {} };

const support: Session = {
  id: 'session-9',
  actor: staff,
  issuedAt: new Date('2026-03-01T09:00:00.000Z'),
  authenticationMethod: 'sso',
  impersonatedBy: 'lead-1',
  extensions: {},
};

class RecordingTrail implements AuditTrail {
  readonly records: AuditRecord[] = [];

  failing = false;

  record(record: AuditRecord): Promise<void> {
    if (this.failing) {
      return Promise.reject(new Error('trail down'));
    }

    this.records.push(record);

    return Promise.resolve();
  }
}

function elevationOf(trail: RecordingTrail): ElevationOptions {
  return {
    scope: new AsyncLocalStorageExecutionScope(),
    trail,
    clock: new FixedClock(new Date('2026-03-01T10:00:00.000Z')),
    ids: new SequentialIdGenerator('audit'),
  };
}

const ofAda = executionContext({ correlationId: 'corr-1', actor: ada, origin: 'http' });
const ofStaff = executionContext({ correlationId: 'corr-2', actor: staff, session: support, origin: 'http' });

describe('the tenants of an actor', () => {
  it('are its tenant and the ones its tenants attribute lists, once each', () => {
    expect(tenantsOf(ada)).toEqual(['acme']);
    expect(tenantsOf(consultant)).toEqual(['acme', 'globex']);
    expect(tenantsOf({ ...consultant, attributes: { tenants: ['acme'] } })).toEqual(['acme']);
    expect(tenantsOf(staff)).toEqual([]);
    expect(tenantsOf({ ...staff, attributes: { tenants: 'acme' } })).toEqual([]);
  });

  it('decide membership, and nothing else does', () => {
    expect(isTenantMember(consultant, 'globex')).toBe(true);
    expect(isTenantMember(ada, 'globex')).toBe(false);
    expect(isTenantMember(staff, 'acme')).toBe(false);
  });
});

describe('tenantReachOf', () => {
  it('is the tenant of the work, and refuses work that names none', () => {
    const scope = new AsyncLocalStorageExecutionScope();

    expect(scope.run(ofAda, () => tenantReachOf(scope))).toEqual({ kind: 'tenant', tenantId: 'acme' });
    expect(() => scope.run(ofStaff, () => tenantReachOf(scope))).toThrow(NoCurrentTenantError);
  });
});

describe('acrossTenants', () => {
  it('records the elevation before the work, then widens the reads to the tenants it names', async () => {
    const trail = new RecordingTrail();
    const options = elevationOf(trail);
    const { scope } = options;

    const reach = await scope.run(ofStaff, () =>
      acrossTenants(options, { reason: 'SUPPORT_TICKET', tenants: ['acme', 'globex'] }, async () => {
        expect(trail.records).toHaveLength(1);

        return tenantReachOf(scope);
      }),
    );

    expect(reach).toEqual({ kind: 'elevated', tenants: ['acme', 'globex'] });

    expect(trail.records).toEqual([
      {
        id: 'audit-1',
        occurredAt: new Date('2026-03-01T10:00:00.000Z'),
        category: 'authorization',
        action: TENANT_ELEVATION_ACTION,
        outcome: 'allowed',
        reason: 'SUPPORT_TICKET',
        actor: { id: 'sam', type: 'user' },
        resource: { type: 'tenants', id: 'acme,globex' },
        correlationId: 'corr-2',
        origin: 'http',
        sessionId: 'session-9',
        impersonatedBy: 'lead-1',
      },
    ]);
  });

  it('keeps writes to one tenant, names every tenant as all, and logs the reason', async () => {
    const trail = new RecordingTrail();
    const options = elevationOf(trail);
    const { scope } = options;
    const caused = executionContext({ ...ofAda, causationId: 'evt-1' });

    await scope.run(caused, () =>
      acrossTenants(options, { reason: 'BILLING', tenants: 'all' }, async () => {
        expect(tenantReachOf(scope)).toEqual({ kind: 'elevated', tenants: 'all' });
        expect(tenantScopeOf(scope)).toEqual({ tenantId: 'acme' });
        expect(logFieldsOf(scope.require())).toMatchObject({ elevation: 'BILLING', tenantId: 'acme' });
      }),
    );

    expect(trail.records[0]).toMatchObject({ resource: { id: '*' }, tenantId: 'acme', causationId: 'evt-1' });
  });

  it('refuses an elevation without a reason or a tenant, and one the trail cannot record', async () => {
    const trail = new RecordingTrail();
    const options = elevationOf(trail);
    const { scope } = options;
    let ran = false;

    const work = async (): Promise<void> => {
      ran = true;
    };

    await scope.run(ofStaff, async () => {
      await expect(acrossTenants(options, { reason: ' ', tenants: 'all' }, work)).rejects.toThrow(
        InvalidTenantElevationError,
      );

      await expect(acrossTenants(options, { reason: 'AUDIT', tenants: [] }, work)).rejects.toThrow('names no tenant');

      trail.failing = true;

      await expect(acrossTenants(options, { reason: 'AUDIT', tenants: 'all' }, work)).rejects.toThrow('trail down');
    });

    expect(ran).toBe(false);
    expect(trail.records).toEqual([]);
  });
});

describe('keys of shared stores', () => {
  it('are confined to the tenant of the work, and refused without one', () => {
    const scope = new AsyncLocalStorageExecutionScope();

    expect(scope.run(ofAda, () => tenantKey(scope, 'login', '10.0.0.1'))).toBe('tenant:acme:login:10.0.0.1');
    expect(scope.run(ofAda, () => tenantCacheKey<number>(scope, 'quote', 'EUR')).name).toBe('tenant:acme:quote:EUR');
    expect(() => scope.run(ofStaff, () => tenantKey(scope, 'login'))).toThrow(NoCurrentTenantError);
  });

  it('never meet for two lists of segments, whatever the segments hold', () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const joined = scope.run(ofAda, () => tenantKey(scope, 'products:x'));
    const split = scope.run(ofAda, () => tenantKey(scope, 'products', 'x'));

    expect(joined).toBe('tenant:acme:products%3Ax');
    expect(split).toBe('tenant:acme:products:x');
  });
});

describe('per-tenant work', () => {
  it('lists the tenants of the directory, and runs a job in the tenant it is given', async () => {
    expect(await new InMemoryTenantDirectory(['acme', 'globex']).tenants()).toEqual(['acme', 'globex']);

    const run = executionContextOfJob('billing.close-month', {
      correlationId: 'corr-3',
      scheduledAt: new Date('2026-03-01T00:00:00.000Z'),
      tenantId: 'globex',
    });

    expect(run).toMatchObject({ tenantId: 'globex', origin: 'schedule', actor: { id: 'system:billing.close-month' } });
  });
});

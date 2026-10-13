import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  FixedClock,
  InMemoryTenantDirectory,
  InvalidTenantElevationError,
  InvalidTenantIdError,
  SequentialIdGenerator,
  acrossTenants,
  assertTenantId,
  executionContext,
  executionContextOfEvent,
  isTenantId,
  tenantPolicyExpressions,
  tenantReachOf,
  tenantScopeOf,
  tenantSettingValues,
  type Actor,
  type ExecutionContext,
} from '../src/index.js';

const WIDENING = ['*', 'acme,globex', 'acme:products', '', ' acme', 'acme;drop', "acme'", 'a'.repeat(64)];
const visitor: Actor = { id: 'anonymous', type: 'anonymous', roles: [], attributes: {} };
const ofAcme = executionContext({ correlationId: 'corr-1', actor: visitor, origin: 'http', tenantId: 'acme' });

describe('the grammar of a tenant id', () => {
  it('keeps slugs and UUIDs, and refuses anything a list, a wildcard or a key could read', () => {
    expect(['acme', 'acme-eu_2', '8c1f6a0e-3a4b-4f5e-9d7c-0123456789ab'].every(isTenantId)).toBe(true);
    expect(WIDENING.filter(isTenantId)).toEqual([]);
    expect(isTenantId(42)).toBe(false);
    expect(assertTenantId('acme')).toBe('acme');
    expect(() => assertTenantId('*')).toThrow(InvalidTenantIdError);
  });

  it('is enforced by every execution context, whatever named the tenant', () => {
    const event = { id: 'e', type: 'billing.invoice-issued', version: 1, occurredAt: '2026-03-01', payload: {} };

    for (const tenantId of WIDENING) {
      expect(() => executionContext({ correlationId: 'c', actor: visitor, origin: 'http', tenantId })).toThrow(
        InvalidTenantIdError,
      );

      expect(() => executionContextOfEvent({ ...event, tenantId }, { consumer: 'reporting' })).toThrow(
        InvalidTenantIdError,
      );
    }

    expect(() =>
      executionContext({ correlationId: 'c', actor: { ...visitor, type: 'user', tenantId: '*' }, origin: 'http' }),
    ).toThrow(InvalidTenantIdError);
  });

  it('is enforced again by the scope of storage, for a context built by hand', () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const forged: ExecutionContext = { ...ofAcme, tenantId: '*' };

    expect(() => scope.run(forged, () => tenantScopeOf(scope))).toThrow(InvalidTenantIdError);
    expect(() => scope.run(forged, () => tenantReachOf(scope))).toThrow(InvalidTenantIdError);

    expect(() =>
      scope.run({ ...ofAcme, elevation: { reason: 'R', tenants: ['acme,globex'] } }, () => tenantReachOf(scope)),
    ).toThrow(InvalidTenantIdError);
  });

  it('is enforced by an elevation and by a directory', async () => {
    const scope = new AsyncLocalStorageExecutionScope();
    const trail = { record: () => Promise.resolve() };
    const options = { scope, trail, clock: new FixedClock(new Date()), ids: new SequentialIdGenerator('a') };
    const elevation = { reason: 'SUPPORT', tenants: ['acme', '*'] };

    await expect(scope.run(ofAcme, () => acrossTenants(options, elevation, async () => undefined))).rejects.toThrow(
      InvalidTenantElevationError,
    );

    expect(() => new InMemoryTenantDirectory(['acme', 'a,b'])).toThrow(InvalidTenantIdError);
  });
});

describe('the settings of row-level security', () => {
  it('never carry a list or a wildcard for work that is not elevated', () => {
    expect(tenantSettingValues(ofAcme)).toEqual({ tenant: 'acme', reach: '', everyTenant: '' });
    expect(tenantSettingValues(undefined)).toEqual({ tenant: '', reach: '', everyTenant: '' });
    expect(() => tenantSettingValues({ ...ofAcme, tenantId: '*' })).toThrow(InvalidTenantIdError);
    expect(() => tenantSettingValues({ ...ofAcme, tenantId: 'acme,globex' })).toThrow(InvalidTenantIdError);
  });

  it('widen reads only through an elevation, kept apart from the tenant', () => {
    const listed = { ...ofAcme, elevation: { reason: 'R', tenants: ['globex', 'initech'] } };
    const every = { ...ofAcme, elevation: { reason: 'R', tenants: 'all' as const } };

    expect(tenantSettingValues(listed)).toEqual({ tenant: 'acme', reach: 'globex,initech', everyTenant: '' });
    expect(tenantSettingValues(every)).toEqual({ tenant: 'acme', reach: '', everyTenant: 'on' });

    expect(() => tenantSettingValues({ ...ofAcme, elevation: { reason: 'R', tenants: ['*'] } })).toThrow(
      InvalidTenantIdError,
    );
  });

  it('read through three settings, and write through the tenant only', () => {
    const { read, write } = tenantPolicyExpressions('"tenant_id"');

    expect(write).toBe(`"tenant_id" = current_setting('ddd_ts_kit.tenant_id', true)`);

    expect(read).toBe(
      `${write} or "tenant_id" = any(string_to_array(current_setting('ddd_ts_kit.reach', true), ',')) or current_setting('ddd_ts_kit.every_tenant', true) = 'on'`,
    );
  });
});

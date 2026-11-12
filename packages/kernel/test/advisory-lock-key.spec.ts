import { describe, expect, it } from 'vitest';
import {
  AdvisoryLockOutsideUnitOfWorkError,
  FixedExecutionScope,
  NoCurrentTenantError,
  advisoryLockKey,
  executionContext,
  type Actor,
} from '../src';

const inside = { inTransaction: () => true };
const outside = { inTransaction: () => false };

function scopeOf(tenantId?: string): FixedExecutionScope {
  const actor: Actor = {
    id: 'ada',
    type: 'user',
    roles: [],
    attributes: {},
    ...(tenantId === undefined ? {} : { tenantId }),
  };

  return new FixedExecutionScope(executionContext({ correlationId: 'corr-1', actor, origin: 'http' }));
}

describe('advisoryLockKey', () => {
  it('is the key itself when the lock belongs to no tenant', () => {
    expect(advisoryLockKey(inside, 'invoice-number', {})).toBe('invoice-number');
  });

  it('carries the tenant of the work, so that two tenants never share a lock', () => {
    expect(advisoryLockKey(inside, 'invoice-number', { tenant: scopeOf('acme') })).toBe('tenant:acme:invoice-number');
    expect(advisoryLockKey(inside, 'a:b', { tenant: scopeOf('globex') })).toBe('tenant:globex:a%3Ab');
  });

  it('refuses a key of tenant data to work that names no tenant', () => {
    expect(() => advisoryLockKey(inside, 'invoice-number', { tenant: scopeOf() })).toThrow(NoCurrentTenantError);
  });

  it('refuses outside a unit of work, before it reads the tenant', () => {
    const refusal = (): string => advisoryLockKey(outside, 'invoice-number', { tenant: scopeOf() });

    expect(refusal).toThrow(AdvisoryLockOutsideUnitOfWorkError);
    expect(refusal).toThrow('Take it inside unitOfWork.run()');
  });
});

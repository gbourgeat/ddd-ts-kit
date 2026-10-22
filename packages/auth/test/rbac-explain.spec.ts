import { describe, expect, it } from 'vitest';
import { anonymousActor, systemActor, type Actor } from '@ddd-ts-kit/kernel';
import { RoleBasedAuthorizer, tenantOfContext, traceText, type CheckRequest } from '../src';
import { ada, billingPermissions, bob } from './support/billing';

const read = billingPermissions['invoice.read'];
const voiding = billingPermissions['invoice.void'];

const authorizer = new RoleBasedAuthorizer({
  roles: { clerk: [read], accountant: [billingPermissions['invoice.issue']], controller: ['billing:*'], auditor: [] },
  inherits: { accountant: ['clerk'] },
});

const withRoles = (roles: readonly string[]): Actor => ({ ...ada, roles });

describe('RoleBasedAuthorizer.explain', () => {
  it('says what each role of the actor grants, and through which included role a grant comes', async () => {
    const { decision, trace } = await authorizer.explain({
      actor: withRoles(['accountant', 'auditor']),
      permission: read,
    });

    expect(decision).toEqual({ allowed: true });

    expect(traceText(trace)).toBe(
      [
        '  billing:invoice.read asked of the roles accountant, auditor',
        '    accountant grants billing:invoice.read, through clerk',
        'x   auditor grants nothing',
      ].join('\n'),
    );
  });

  it('visits every role of a refused actor, a role nobody declared included', async () => {
    const { decision, trace } = await authorizer.explain({
      actor: withRoles(['clerk', 'intern']),
      permission: voiding,
    });

    expect(decision).toEqual({ allowed: false, reason: 'NO_MATCHING_ROLE' });

    expect(traceText(trace)).toBe(
      [
        '  billing:invoice.void asked of the roles clerk, intern',
        'x   clerk grants billing:invoice.read',
        'x   intern is not a declared role',
      ].join('\n'),
    );
  });

  it('names the wildcard that covers the permission', async () => {
    const { trace } = await authorizer.explain({ actor: withRoles(['controller']), permission: voiding });

    expect(traceText(trace)).toContain('    controller grants billing:*, which covers billing:invoice.void');
  });

  it('says that an actor without a role was refused before any role was asked, and the anonymous actor without a word', async () => {
    const nobody = await authorizer.explain({ actor: withRoles([]), permission: read });

    expect(nobody.decision).toEqual({ allowed: false, reason: 'NO_MATCHING_ROLE' });
    expect(traceText(nobody.trace)).toBe('x billing:invoice.read asked of no role: the actor holds none');

    expect(await authorizer.explain({ actor: anonymousActor(), permission: read })).toEqual({
      decision: { allowed: false, reason: 'ANONYMOUS' },
      trace: [],
    });
  });
});

describe('RoleBasedAuthorizer.explain, with the tenant check', () => {
  const tenanted = new RoleBasedAuthorizer({
    roles: { clerk: [read], operator: ['*'], automation: [read] },
    tenantOf: tenantOfContext,
    crossTenantRoles: ['operator'],
    systemRole: 'automation',
  });

  const operator: Actor = { id: 'ops', type: 'user', roles: ['operator'], attributes: {} };
  const job = systemActor('invoice-reminder');

  const lastLine = async (request: Omit<CheckRequest, 'permission'>): Promise<string | undefined> =>
    traceText((await tenanted.explain({ ...request, permission: read })).trace)
      .split('\n')
      .at(-1);

  it('ends with where the request may act', async () => {
    expect(await lastLine({ actor: bob, context: { tenantId: 'acme' } })).toBe(
      '  the actor belongs to acme, the tenant the request targets',
    );

    expect(await lastLine({ actor: bob, context: { tenantId: 'globex' } })).toBe(
      'x the actor does not belong to globex, the tenant the request targets',
    );

    expect(await lastLine({ actor: bob, context: { tenantId: 'acme' }, workTenantId: 'globex' })).toBe(
      'x the request targets acme while the work runs in globex',
    );

    expect(await lastLine({ actor: bob, context: { tenantId: '*' } })).toBe('x "*" is not a tenant id');
    expect(await lastLine({ actor: bob })).toBe('  the request targets no tenant');
    expect(await lastLine({ actor: operator, context: { tenantId: 'globex' } })).toBe('  operator acts across tenants');
  });

  it('says that a system acts in the tenant of its work, and names its role', async () => {
    const { decision, trace } = await tenanted.explain({
      actor: job,
      permission: read,
      context: { tenantId: 'acme' },
      workTenantId: 'acme',
    });

    expect(decision).toEqual({ allowed: true });

    expect(traceText(trace)).toBe(
      [
        '  billing:invoice.read asked of the roles automation (automation is the role of the system)',
        '    automation grants billing:invoice.read',
        '  the system acts in acme, the tenant of its work',
      ].join('\n'),
    );

    expect(await lastLine({ actor: job, context: { tenantId: 'acme' } })).toBe(
      'x the system acts in the tenant of its work only, and this work runs in none',
    );
  });

  it('says that a system without a role was refused before any role was asked', async () => {
    const roleless = new RoleBasedAuthorizer({ roles: { clerk: [read] } });

    expect(traceText((await roleless.explain({ actor: job, permission: read })).trace)).toBe(
      'x billing:invoice.read asked of no role: the system holds none',
    );
  });
});

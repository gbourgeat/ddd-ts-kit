import { describe, expect, it, beforeEach } from 'vitest';
import { anonymousActor, systemActor, type Actor } from '@ddd-ts-kit/kernel';
import { AuthorizationSetupError, RoleBasedAuthorizer, tenantOfContext, type Permission } from '../src';
import { authorizerContract } from '../src/testing';
import { ada, billingPermissions, bob, catalogPermissions, root } from './support/billing';

const issue = billingPermissions['invoice.issue'];
const read = billingPermissions['invoice.read'];
const voiding = billingPermissions['invoice.void'];
const editProduct = catalogPermissions['product.edit'];

const roles = {
  admin: ['*'],
  accountant: [issue, 'billing:invoice.read'],
  'billing-lead': ['billing:*'],
  clerk: [read],
};

authorizerContract(
  { describe, it, expect, beforeEach },
  {
    name: 'RoleBasedAuthorizer',
    create: () => ({
      authorizer: new RoleBasedAuthorizer({ roles }),
      granted: { actor: ada, permission: issue, resource: { type: 'invoice', id: 'inv-1' } },
      refused: { actor: bob, permission: issue, resource: { type: 'invoice', id: 'inv-1' } },
    }),
  },
);

authorizerContract(
  { describe, it, expect, beforeEach },
  {
    name: 'RoleBasedAuthorizer with the tenant check',
    create: () => ({
      authorizer: new RoleBasedAuthorizer({ roles, tenantOf: tenantOfContext }),
      granted: { actor: ada, permission: issue, context: { tenantId: 'acme' } },
      refused: { actor: ada, permission: issue, context: { tenantId: 'globex' } },
    }),
  },
);

describe('RoleBasedAuthorizer', () => {
  const authorizer = new RoleBasedAuthorizer({ roles });
  const allowed = (actor: Actor, permission: Permission = issue) => authorizer.check({ actor, permission });

  it('grants what one of the roles of the actor lists, by permission or by id', async () => {
    expect(await allowed(ada, issue)).toEqual({ allowed: true });
    expect(await allowed(ada, read)).toEqual({ allowed: true });
    expect(await allowed(ada, voiding)).toEqual({ allowed: false, reason: 'NO_MATCHING_ROLE' });
  });

  it('grants a whole context with its wildcard, and no other context', async () => {
    const lead: Actor = { ...ada, roles: ['billing-lead'] };

    expect(await allowed(lead, voiding)).toEqual({ allowed: true });
    expect(await allowed(lead, editProduct)).toEqual({ allowed: false, reason: 'NO_MATCHING_ROLE' });
  });

  it('grants everything with the global wildcard', async () => {
    expect(await allowed(root, voiding)).toEqual({ allowed: true });
    expect(await allowed(root, editProduct)).toEqual({ allowed: true });
  });

  it('ignores a role it does not know', async () => {
    expect(await allowed({ ...ada, roles: ['intern'] })).toEqual({ allowed: false, reason: 'NO_MATCHING_ROLE' });
  });

  it('refuses the anonymous actor', async () => {
    expect(await allowed(anonymousActor())).toEqual({ allowed: false, reason: 'ANONYMOUS' });
  });

  it('refuses a grant that could never match', () => {
    expect(() => new RoleBasedAuthorizer({ roles: { clerk: ['invoice.read'] } })).toThrow(AuthorizationSetupError);
    expect(() => new RoleBasedAuthorizer({ roles: { clerk: ['billing:invoice.*'] } })).toThrow('is not a grant');
  });

  it('lists everything or nothing: it decides on actions, not on elements', async () => {
    const scope = (actor: Actor, permission: Permission = read) =>
      authorizer.listAccessible({ actor, permission, resourceType: 'invoice' });

    expect(await scope(bob)).toEqual({ kind: 'all' });
    expect(await scope(bob, voiding)).toEqual({ kind: 'none' });
    expect(await scope(anonymousActor())).toEqual({ kind: 'none' });
  });
});

describe('RoleBasedAuthorizer role hierarchy', () => {
  const authorizer = new RoleBasedAuthorizer({
    roles: { clerk: [read], accountant: [issue], controller: [voiding], auditor: [] },
    inherits: { accountant: ['clerk'], controller: ['accountant'], partner: ['controller', 'auditor'] },
  });

  const allowed = async (role: string, permission: Permission = read) =>
    (await authorizer.check({ actor: { ...ada, roles: [role] }, permission })).allowed;

  it('gives a role what the roles it includes grant, at any distance', async () => {
    expect(await allowed('accountant', read)).toBe(true);
    expect(await allowed('controller', read)).toBe(true);
    expect(await allowed('controller', issue)).toBe(true);
    expect(await allowed('partner', voiding)).toBe(true);
  });

  it('does not give an included role what the including role grants', async () => {
    expect(await allowed('clerk', issue)).toBe(false);
    expect(await allowed('accountant', voiding)).toBe(false);
  });

  it('refuses a hierarchy that loops', () => {
    expect(() => new RoleBasedAuthorizer({ roles: {}, inherits: { a: ['b'], b: ['c'], c: ['a'] } })).toThrow(
      'Role hierarchy cycle: a -> b -> c -> a',
    );
  });

  it('refuses a hierarchy naming an unknown role', () => {
    expect(() => new RoleBasedAuthorizer({ roles: { clerk: [read] }, inherits: { clerk: ['ghost'] } })).toThrow(
      'Role "clerk" inherits the unknown role "ghost"',
    );
  });
});

describe('RoleBasedAuthorizer tenant check', () => {
  const authorizer = new RoleBasedAuthorizer({
    roles: { ...roles, operator: ['*'] },
    tenantOf: tenantOfContext,
    crossTenantRoles: ['operator'],
  });

  const operator: Actor = { id: 'ops', type: 'user', roles: ['operator'], attributes: {} };

  const about = (actor: Actor, tenantId?: string) =>
    authorizer.check({ actor, permission: read, ...(tenantId === undefined ? {} : { context: { tenantId } }) });

  it('refuses a request that targets another tenant than the actor', async () => {
    expect(await about(ada, 'acme')).toEqual({ allowed: true });
    expect(await about(ada, 'globex')).toEqual({ allowed: false, reason: 'TENANT_MISMATCH' });
  });

  it('refuses an actor without tenant on a request that targets one', async () => {
    expect(await about(root, 'acme')).toEqual({ allowed: false, reason: 'TENANT_MISMATCH' });
  });

  it('lets a request that targets no tenant through', async () => {
    expect(await about(ada)).toEqual({ allowed: true });
  });

  it('lets the roles declared cross-tenant act everywhere', async () => {
    expect(await about(operator, 'globex')).toEqual({ allowed: true });
  });

  it('checks the role before the tenant', async () => {
    expect(await authorizer.check({ actor: bob, permission: issue, context: { tenantId: 'globex' } })).toEqual({
      allowed: false,
      reason: 'NO_MATCHING_ROLE',
    });
  });

  it('scopes a list to the tenant of the actor, as a filter for the read port', async () => {
    const scope = (actor: Actor) => authorizer.listAccessible({ actor, permission: read, resourceType: 'invoice' });

    expect(await scope(ada)).toEqual({ kind: 'filter', filter: { tenantId: 'acme' } });
    expect(await scope(operator)).toEqual({ kind: 'all' });
    expect(await scope(root)).toEqual({ kind: 'none' });
  });
});

describe('RoleBasedAuthorizer tenant check, for an actor of several tenants and in the work of a tenant', () => {
  const authorizer = new RoleBasedAuthorizer({
    roles: { ...roles, operator: ['*'], automation: [read] },
    tenantOf: tenantOfContext,
    crossTenantRoles: ['operator'],
    systemRole: 'automation',
  });

  const consultant: Actor = { id: 'cleo', type: 'user', roles: ['clerk'], attributes: { tenants: ['acme', 'globex'] } };
  const job = systemActor('invoice-reminder');

  const about = (actor: Actor, tenantId: string, workTenantId?: string) =>
    authorizer.check({
      actor,
      permission: read,
      context: { tenantId },
      ...(workTenantId === undefined ? {} : { workTenantId }),
    });

  const scope = (actor: Actor, workTenantId?: string) =>
    authorizer.listAccessible({
      actor,
      permission: read,
      resourceType: 'invoice',
      ...(workTenantId === undefined ? {} : { workTenantId }),
    });

  it('lets an actor act in each tenant it belongs to, and in no other', async () => {
    expect(await about(consultant, 'acme')).toEqual({ allowed: true });
    expect(await about(consultant, 'globex')).toEqual({ allowed: true });
    expect(await about(consultant, 'initech')).toEqual({ allowed: false, reason: 'TENANT_MISMATCH' });
  });

  it('refuses a message that targets another tenant than the one the work runs in, even one the actor belongs to', async () => {
    expect(await about(consultant, 'globex', 'globex')).toEqual({ allowed: true });
    expect(await about(consultant, 'acme', 'globex')).toEqual({ allowed: false, reason: 'TENANT_MISMATCH' });
    expect(await about(ada, 'acme', 'globex')).toEqual({ allowed: false, reason: 'TENANT_MISMATCH' });
  });

  it('refuses a target that cannot be a tenant id, whatever the credential lists', async () => {
    const forged: Actor = { ...consultant, attributes: { tenants: ['*', 'acme,globex'] } };

    expect(await about(forged, '*')).toEqual({ allowed: false, reason: 'TENANT_MISMATCH' });
    expect(await about(forged, 'acme,globex')).toEqual({ allowed: false, reason: 'TENANT_MISMATCH' });
  });

  it('lets the system act in the tenant its work runs in, and nowhere outside of one', async () => {
    expect(await about(job, 'acme', 'acme')).toEqual({ allowed: true });
    expect(await about(job, 'globex', 'acme')).toEqual({ allowed: false, reason: 'TENANT_MISMATCH' });
    expect(await about(job, 'acme')).toEqual({ allowed: false, reason: 'TENANT_MISMATCH' });
  });

  it('keeps the cross-tenant roles above the tenant of the work', async () => {
    const operator: Actor = { id: 'ops', type: 'user', roles: ['operator'], attributes: {} };

    expect(await about(operator, 'globex', 'acme')).toEqual({ allowed: true });
  });

  it('scopes a list to the tenant of the work the actor belongs to', async () => {
    expect(await scope(consultant, 'globex')).toEqual({ kind: 'filter', filter: { tenantId: 'globex' } });
    expect(await scope(ada, 'acme')).toEqual({ kind: 'filter', filter: { tenantId: 'acme' } });
    expect(await scope(ada, 'globex')).toEqual({ kind: 'none' });
    expect(await scope(job, 'acme')).toEqual({ kind: 'filter', filter: { tenantId: 'acme' } });
  });

  it('outside of a tenant work, scopes a list to the one tenant of the actor, and to nothing for several', async () => {
    expect(await scope(ada)).toEqual({ kind: 'filter', filter: { tenantId: 'acme' } });
    expect(await scope(consultant)).toEqual({ kind: 'none' });
    expect(await scope(job)).toEqual({ kind: 'none' });
  });
});

describe('RoleBasedAuthorizer tenancy options', () => {
  it('refuses a cross-tenant role or a system role that no role declares', () => {
    expect(() => new RoleBasedAuthorizer({ roles, tenantOf: tenantOfContext, crossTenantRoles: ['amdin'] })).toThrow(
      new AuthorizationSetupError('Role "amdin" is named in the options but declared in no role.'),
    );

    expect(() => new RoleBasedAuthorizer({ roles, systemRole: 'automation' })).toThrow(AuthorizationSetupError);
  });

  it('refuses cross-tenant roles without the tenant check they would bypass', () => {
    expect(() => new RoleBasedAuthorizer({ roles, crossTenantRoles: ['admin'] })).toThrow(
      'crossTenantRoles has no effect without tenantOf',
    );
  });
});

describe('RoleBasedAuthorizer and the system actor', () => {
  const job = systemActor('invoice-reminder');

  it('gives the system no right unless a role is named for it', async () => {
    const authorizer = new RoleBasedAuthorizer({ roles });

    expect(await authorizer.check({ actor: job, permission: read })).toEqual({
      allowed: false,
      reason: 'NO_MATCHING_ROLE',
    });
  });

  it('gives the system the role named for it', async () => {
    const authorizer = new RoleBasedAuthorizer({ roles: { ...roles, automation: [read] }, systemRole: 'automation' });

    expect(await authorizer.check({ actor: job, permission: read })).toEqual({ allowed: true });
    expect((await authorizer.check({ actor: job, permission: issue })).allowed).toBe(false);
    expect((await authorizer.check({ actor: { ...bob, roles: [] }, permission: read })).allowed).toBe(false);
  });

  it('a user whose roles name the system role does not hold what the system holds', async () => {
    const authorizer = new RoleBasedAuthorizer({ roles: { ...roles, automation: [read] }, systemRole: 'automation' });
    const impostor: Actor = { ...bob, roles: ['automation'] };

    const decision = await authorizer.check({ actor: impostor, permission: read });
    const scope = await authorizer.listAccessible({ actor: impostor, permission: read, resourceType: 'invoice' });

    expect(decision).toEqual({ allowed: false, reason: 'NO_MATCHING_ROLE' });
    expect(scope).toEqual({ kind: 'none' });
  });

  it('a user whose roles name the system role keeps what its other roles grant', async () => {
    const authorizer = new RoleBasedAuthorizer({ roles: { ...roles, automation: [issue] }, systemRole: 'automation' });
    const clerk: Actor = { ...bob, roles: ['clerk', 'automation'] };

    const reading = await authorizer.check({ actor: clerk, permission: read });
    const issuing = await authorizer.check({ actor: clerk, permission: issue });

    expect(reading).toEqual({ allowed: true });
    expect(issuing).toEqual({ allowed: false, reason: 'NO_MATCHING_ROLE' });
  });

  it('a user whose roles name the system role does not act across tenants through it', async () => {
    const authorizer = new RoleBasedAuthorizer({
      roles: { ...roles, automation: ['*'] },
      tenantOf: tenantOfContext,
      crossTenantRoles: ['automation'],
      systemRole: 'automation',
    });

    const decision = await authorizer.check({
      actor: { ...ada, roles: ['clerk', 'automation'] },
      permission: read,
      context: { tenantId: 'globex' },
    });

    expect(decision).toEqual({ allowed: false, reason: 'TENANT_MISMATCH' });
  });
});

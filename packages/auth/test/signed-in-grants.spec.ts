import { beforeEach, describe, expect, it } from 'vitest';
import { anonymousActor, systemActor, type Actor } from '@ddd-ts-kit/kernel';
import {
  AuthorizationSetupError,
  ListingNotSupportedError,
  RoleBasedAuthorizer,
  SignedInGrantsAuthorizer,
  traceText,
  type Authorizer,
  type Decision,
} from '../src';
import { AllowAll, authorizerContract, DenyAll } from '../src/testing';
import { billingPermissions, bob, catalogPermissions } from './support/billing';

const issue = billingPermissions['invoice.issue'];
const read = billingPermissions['invoice.read'];
const editProduct = catalogPermissions['product.edit'];

const model = new RoleBasedAuthorizer({ roles: { clerk: [read] } });
const authorizer = new SignedInGrantsAuthorizer({ grants: ['catalog:*'], otherwise: model });
const service: Actor = { id: 'mailer', type: 'service', roles: [], attributes: {} };

/** A model that can only check. */
class CheckOnly implements Authorizer {
  check(): Promise<Decision> {
    return new DenyAll().check();
  }
}

authorizerContract(
  { describe, it, expect, beforeEach },
  {
    name: 'SignedInGrantsAuthorizer',
    create: () => ({
      authorizer,
      granted: { actor: bob, permission: editProduct },
      refused: { actor: bob, permission: issue },
    }),
  },
);

describe('SignedInGrantsAuthorizer', () => {
  it('grants every signed-in person what it lists, whatever their roles, and asks the model for the rest', async () => {
    expect(await authorizer.check({ actor: bob, permission: editProduct })).toEqual({ allowed: true });
    expect(await authorizer.check({ actor: bob, permission: read })).toEqual({ allowed: true });

    expect(await authorizer.check({ actor: bob, permission: issue })).toEqual({
      allowed: false,
      reason: 'NO_MATCHING_ROLE',
    });
  });

  it('gives nothing to systems, services and anonymous actors', async () => {
    for (const actor of [systemActor('desk.close-the-day'), service, anonymousActor()]) {
      expect((await authorizer.check({ actor, permission: editProduct })).allowed).toBe(false);
    }
  });

  it('lists everything of what it grants, and leaves the other listings to the model', async () => {
    const request = { actor: bob, resourceType: 'invoice' };

    expect(await authorizer.listAccessible({ ...request, permission: editProduct })).toEqual({ kind: 'all' });
    expect(await authorizer.listAccessible({ ...request, permission: read })).toEqual({ kind: 'all' });
    expect(await authorizer.listAccessible({ ...request, permission: issue })).toEqual({ kind: 'none' });
  });

  it('cannot list what it does not grant over a model that cannot enumerate', async () => {
    const checking = new SignedInGrantsAuthorizer({ grants: [editProduct], otherwise: new CheckOnly() });
    const request = { actor: bob, resourceType: 'invoice' };

    expect(await checking.listAccessible({ ...request, permission: editProduct })).toEqual({ kind: 'all' });

    await expect(checking.listAccessible({ ...request, permission: issue })).rejects.toBeInstanceOf(
      ListingNotSupportedError,
    );
  });

  it('refuses a grant that names no permission when it is built', () => {
    expect(() => new SignedInGrantsAuthorizer({ grants: ['catalog'], otherwise: model })).toThrow(
      AuthorizationSetupError,
    );
  });
});

describe('SignedInGrantsAuthorizer.explain', () => {
  it('names the grant of every signed-in person that covers the permission', async () => {
    const { decision, trace } = await authorizer.explain({ actor: bob, permission: editProduct });

    expect(decision).toEqual({ allowed: true });
    expect(traceText(trace)).toBe('  every signed-in person holds catalog:*, which covers catalog:product.edit');
  });

  it('otherwise says what the model said, one level deeper', async () => {
    const { decision, trace } = await authorizer.explain({ actor: bob, permission: read });

    expect(decision).toEqual({ allowed: true });

    expect(traceText(trace)).toBe(
      [
        'x no grant of every signed-in person covers billing:invoice.read',
        '  the model decides',
        '    billing:invoice.read asked of the roles clerk',
        '      clerk grants billing:invoice.read',
      ].join('\n'),
    );
  });

  it('gives the decision of a model that allows without explaining, one level deeper', async () => {
    const allowing = new SignedInGrantsAuthorizer({ grants: ['catalog:*'], otherwise: new AllowAll() });

    const { decision, trace } = await allowing.explain({ actor: bob, permission: read });

    expect(decision).toEqual({ allowed: true });

    expect(traceText(trace)).toBe(
      ['x no grant of every signed-in person covers billing:invoice.read', '  the model allows'].join('\n'),
    );
  });

  it('says that a system is not a signed-in person, and gives the decision of a model that does not explain', async () => {
    const checking = new SignedInGrantsAuthorizer({ grants: ['catalog:*'], otherwise: new CheckOnly() });

    const { decision, trace } = await checking.explain({ actor: service, permission: editProduct });

    expect(decision).toEqual({ allowed: false, reason: 'DENIED_BY_TEST' });

    expect(traceText(trace)).toBe(
      ['x the actor is a service, not a signed-in person', 'x the model refuses: DENIED_BY_TEST'].join('\n'),
    );
  });
});

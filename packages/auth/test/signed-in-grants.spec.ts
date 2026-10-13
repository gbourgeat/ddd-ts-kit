import { beforeEach, describe, expect, it } from 'vitest';
import { anonymousActor, systemActor, type Actor } from '@ddd-ts-kit/kernel';
import {
  AuthorizationSetupError,
  ListingNotSupportedError,
  RoleBasedAuthorizer,
  SignedInGrantsAuthorizer,
  type Authorizer,
  type Decision,
} from '../src/index.js';
import { authorizerContract, DenyAll } from '../src/testing.js';
import { billingPermissions, bob, catalogPermissions } from './support/billing.js';

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

import { beforeEach, describe, expect, it } from 'vitest';
import { anonymousActor } from '@ddd-ts-kit/kernel';
import { resetSequences } from '@ddd-ts-kit/testing';
import { InvalidCredentialError, RoleBasedAuthorizer } from '../src';
import { AllowAll, DenyAll, FakeAuthenticator, RecordingAuthorizer, anActor } from '../src/testing';
import { ada, billingPermissions } from './support/billing';

const read = billingPermissions['invoice.read'];

describe('anActor', () => {
  beforeEach(resetSequences);

  it('builds a valid user by default, each with an id of its own', () => {
    expect(anActor().build()).toEqual({ id: 'actor-1', type: 'user', roles: [], attributes: {} });
    expect(anActor().build().id).toBe('actor-2');
  });

  it('states only what matters to the test', () => {
    const accountant = anActor().named('ada').ofTenant('acme').withRole('accountant').withRole('clerk', 'auditor');

    expect(accountant.withAttributes({ department: 'sales' }).build()).toEqual({
      id: 'ada',
      type: 'user',
      tenantId: 'acme',
      roles: ['accountant', 'clerk', 'auditor'],
      attributes: { department: 'sales' },
    });

    expect(anActor().asService().named('billing-worker').build().type).toBe('service');
  });

  it('is immutable: a shared builder does not leak from one test to the next', () => {
    const base = anActor().named('ada');

    base.withRole('admin');

    expect(base.build().roles).toEqual([]);
  });
});

describe('the fake authorizers', () => {
  it('AllowAll grants everything and lists everything', async () => {
    const authorizer = new AllowAll();

    expect(await authorizer.check()).toEqual({ allowed: true });
    expect(await authorizer.listAccessible()).toEqual({ kind: 'all' });
  });

  it('DenyAll refuses everything with the reason it is given', async () => {
    expect(await new DenyAll().check()).toEqual({ allowed: false, reason: 'DENIED_BY_TEST' });
    expect(await new DenyAll('NO_MATCHING_ROLE').check()).toEqual({ allowed: false, reason: 'NO_MATCHING_ROLE' });
    expect(await new DenyAll().listAccessible()).toEqual({ kind: 'none' });
  });

  it('RecordingAuthorizer keeps what it was asked, as data', async () => {
    const authorizer = new RecordingAuthorizer();

    await authorizer.check({ actor: ada, permission: read, resource: { type: 'invoice', id: 'inv-1' } });
    await authorizer.listAccessible({ actor: ada, permission: read, resourceType: 'invoice' });

    expect(authorizer.checks).toEqual([{ actor: ada, permission: read, resource: { type: 'invoice', id: 'inv-1' } }]);
    expect(authorizer.listings).toEqual([{ actor: ada, permission: read, resourceType: 'invoice' }]);
  });

  it('RecordingAuthorizer answers what the authorizer it wraps answers', async () => {
    const authorizer = new RecordingAuthorizer(new RoleBasedAuthorizer({ roles: { accountant: [read] } }));
    const stranger = anActor().build();

    expect((await authorizer.check({ actor: ada, permission: read })).allowed).toBe(true);
    expect((await authorizer.check({ actor: stranger, permission: read })).allowed).toBe(false);

    expect(await authorizer.listAccessible({ actor: stranger, permission: read, resourceType: 'invoice' })).toEqual({
      kind: 'none',
    });
  });
});

describe('FakeAuthenticator', () => {
  const authenticator = new FakeAuthenticator({ 'token-of-ada': ada });

  it('knows a few credentials by heart', async () => {
    expect(await authenticator.authenticate('token-of-ada')).toBe(ada);
    expect(await authenticator.authenticate(undefined)).toEqual(anonymousActor());
    await expect(authenticator.authenticate('stolen')).rejects.toBeInstanceOf(InvalidCredentialError);
  });
});

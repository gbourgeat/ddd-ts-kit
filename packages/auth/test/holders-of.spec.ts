import { beforeEach, describe, expect, it } from 'vitest';
import { systemActor } from '@ddd-ts-kit/kernel';
import { resetSequences } from '@ddd-ts-kit/testing';
import { anActor, holdersOf } from '../src/testing';
import { billingPermissions } from './support/billing';

const issue = billingPermissions['invoice.issue'];
const read = billingPermissions['invoice.read'];
const voiding = billingPermissions['invoice.void'];

describe('holdersOf', () => {
  beforeEach(resetSequences);

  it('gives a user of the role holder, the one the authorizer grants the permission to', async () => {
    const { holder, authorizer } = holdersOf(issue);

    expect(holder).toEqual({ id: 'actor-1', type: 'user', roles: ['holder'], attributes: {} });
    expect(await authorizer.check({ actor: holder, permission: issue })).toEqual({ allowed: true });
  });

  it('grants nothing else to the holder', async () => {
    const { holder, authorizer } = holdersOf(issue);

    expect(await authorizer.check({ actor: holder, permission: voiding })).toMatchObject({ allowed: false });
  });

  it('refuses an actor without the role, as the refusal of a generated spec expects', async () => {
    const { authorizer } = holdersOf(issue);

    expect(await authorizer.check({ actor: anActor().build(), permission: issue })).toMatchObject({
      allowed: false,
      reason: 'NO_MATCHING_ROLE',
    });
  });

  it('grants the permission to the system actor of a job or a reaction, and never to a user who names its role', async () => {
    const { authorizer } = holdersOf(issue);

    expect(await authorizer.check({ actor: systemActor('billing.issue-monthly'), permission: issue })).toEqual({
      allowed: true,
    });

    const claimed = anActor().withRole('system').build();

    expect(await authorizer.check({ actor: claimed, permission: issue })).toMatchObject({ allowed: false });
  });

  it('grants every permission it is given, and every permission a pattern covers', async () => {
    const several = holdersOf(issue, read);
    const everything = holdersOf('billing:*');

    expect(await several.authorizer.check({ actor: several.holder, permission: read })).toEqual({ allowed: true });

    expect(await several.authorizer.check({ actor: several.holder, permission: voiding })).toMatchObject({
      allowed: false,
    });

    expect(await everything.authorizer.check({ actor: everything.holder, permission: voiding })).toEqual({
      allowed: true,
    });
  });

  it('lists everything the permission covers to the holder, and nothing to anybody else', async () => {
    const { holder, authorizer } = holdersOf(read);

    expect(await authorizer.listAccessible?.({ actor: holder, permission: read, resourceType: 'invoice' })).toEqual({
      kind: 'all',
    });

    expect(
      await authorizer.listAccessible?.({ actor: anActor().build(), permission: read, resourceType: 'invoice' }),
    ).toEqual({ kind: 'none' });
  });
});

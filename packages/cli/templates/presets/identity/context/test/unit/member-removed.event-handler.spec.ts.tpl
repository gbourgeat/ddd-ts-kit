import { describe, expect, it } from '{{tests.module}}';
import { MemberRemovedEventHandler } from '{{alias.context}}/application/event-handlers/member-removed.event-handler{{alias.ext}}';
import { MemberRemoved } from '{{alias.context}}/domain/events/member-removed.event{{alias.ext}}';
import { FakeIdentityProviderAdmin } from '{{alias.context}}/test/fakes/identity-provider-admin.fake{{alias.ext}}';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('When the fact is committed, the identity provider follows', () => {
  it('asks the provider once', async () => {
    const provider = new FakeIdentityProviderAdmin();

    await new MemberRemovedEventHandler(provider).handle(
      new MemberRemoved('member-1', at, { organisationId: 'acme', accountId: 'subject-ada' }),
    );

    expect(provider.asked).toEqual(['remove subject-ada from acme']);
  });

  it('lets the failure of the provider through, for the platform to report', async () => {
    const provider = new FakeIdentityProviderAdmin();

    provider.failWith(new Error('provider unreachable'));

    await expect(
      new MemberRemovedEventHandler(provider).handle(
        new MemberRemoved('member-1', at, { organisationId: 'acme', accountId: 'subject-ada' }),
      ),
    ).rejects.toThrow('provider unreachable');
  });
});

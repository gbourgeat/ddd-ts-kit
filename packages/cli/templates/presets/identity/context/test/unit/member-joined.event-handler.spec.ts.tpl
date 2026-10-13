import { describe, expect, it } from '{{tests.module}}';
import { MemberJoinedEventHandler } from '{{alias.context}}/application/event-handlers/member-joined.event-handler{{alias.ext}}';
import { MemberJoined } from '{{alias.context}}/domain/events/member-joined.event{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { FakeIdentityProviderAdmin } from '{{alias.context}}/test/fakes/identity-provider-admin.fake{{alias.ext}}';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('When the fact is committed, the identity provider follows', () => {
  it('asks the provider once', async () => {
    const provider = new FakeIdentityProviderAdmin();

    await new MemberJoinedEventHandler(provider).handle(
      new MemberJoined('member-1', at, { organisationId: 'acme', accountId: 'subject-ada', role: MemberRole.Member }),
    );

    expect(provider.asked).toEqual(['add subject-ada to acme']);
  });

  it('lets the failure of the provider through, for the platform to report', async () => {
    const provider = new FakeIdentityProviderAdmin();

    provider.failWith(new Error('provider unreachable'));

    await expect(
      new MemberJoinedEventHandler(provider).handle(
        new MemberJoined('member-1', at, { organisationId: 'acme', accountId: 'subject-ada', role: MemberRole.Member }),
      ),
    ).rejects.toThrow('provider unreachable');
  });
});

import { describe, expect, it } from '{{tests.module}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { memberJoinedV1 } from '{{alias.context}}/published-language/member-joined.v1.integration-event{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { arrangeIdentity } from '{{alias.context}}/test/worlds/{{context.kebab}}.world{{alias.ext}}';

const joining = memberJoinedV1.create(
  { memberId: 'member-1', organisationId: 'acme', accountId: 'subject-grace', role: MemberRole.Member },
  { id: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' },
);

describe('When a member joins, the identity provider follows', () => {
  it('adds the person to the organisation while the membership holds, once, and again after a failure', async () => {
    const { application, members, identityProvider } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-grace').build());
    await application.start();
    identityProvider.failWith(new Error('provider unreachable'));

    await expect(application.eventBus.publish([joining])).rejects.toThrow();

    identityProvider.answerAgain();
    await application.eventBus.publish([joining]);
    await application.eventBus.publish([joining]);

    expect(identityProvider.asked).toEqual(['add subject-grace to acme']);
  });

  it('takes the person out when the membership ended before a late delivery: a removal is never undone by a retry', async () => {
    const { application, members, identityProvider } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-grace').removedAt(new Date('2026-01-01T00:00:00.000Z')).build());
    await application.start();
    await application.eventBus.publish([joining]);

    expect(identityProvider.asked).toEqual(['remove subject-grace from acme']);
  });
});

import { describe, expect, it } from '{{tests.module}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { RemoveMemberCommand } from '{{alias.context}}/application/commands/remove-member/remove-member.command{{alias.ext}}';
import { aDelegation } from '{{alias.context}}/test/builders/delegation.builder{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { arrangeIdentity } from '{{alias.context}}/test/unit/identity-application{{alias.ext}}';

describe('Remove member', () => {
  it('removes the member, ends every delegation they gave or received, and tells the provider and the other contexts', async () => {
    const { application, members, delegations, identityProvider, as } = arrangeIdentity();
    const now = application.clock.now();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Admin).build());
    await members.save(aMember().of('acme', 'subject-alan').build());

    await delegations.save(
      aDelegation()
        .identifiedBy('delegation-1')
        .to('subject-alan')
        .lending(MemberRight.InviteMembers)
        .between(now, new Date(now.getTime() + 86_400_000))
        .build(),
    );

    const before = { published: application.eventBus.published.length, asked: identityProvider.asked.length };

    await application.commandBus.execute(new RemoveMemberCommand(as('subject-ada'), 'acme', 'subject-alan'));

    expect(await members.findOf('acme', 'subject-alan')).toBeUndefined();
    expect((await delegations.findById('delegation-1'))?.isActiveAt(now)).toBe(false);
    expect(identityProvider.asked.slice(before.asked)).toEqual(['remove subject-alan from acme']);

    expect(application.eventBus.published.slice(before.published).map((event) => event.type)).toEqual([
      '{{context.kebab}}.member.removed',
      '{{context.kebab}}.delegation.revoked',
    ]);
  });

  it('refuses a person who is not a member, and keeps the last owner', async () => {
    const { application, members, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());

    await expect(
      application.commandBus.execute(new RemoveMemberCommand(as('subject-ada'), 'acme', 'subject-nobody')),
    ).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });

    await expect(
      application.commandBus.execute(new RemoveMemberCommand(as('subject-ada'), 'acme', 'subject-ada')),
    ).rejects.toMatchObject({ code: 'LAST_OWNER' });
  });

  it('is refused to a member who does not manage the members', async () => {
    const { application, members, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-alan').build());
    await members.save(aMember().of('acme', 'subject-grace').build());

    await expect(
      application.commandBus.execute(new RemoveMemberCommand(as('subject-alan'), 'acme', 'subject-grace')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

import { describe, expect, it } from '{{tests.module}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
import { aDelegation } from '{{alias.context}}/test/builders/delegation.builder{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { arrangeIdentity } from '{{alias.context}}/test/unit/identity-application{{alias.ext}}';

describe('Change member role', () => {
  it('gives the member the new role, tells the other contexts, and ends the delegations they gave', async () => {
    const { application, members, delegations, as } = arrangeIdentity();
    const now = application.clock.now();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());
    await members.save(aMember().of('acme', 'subject-grace').as(MemberRole.Owner).build());
    await members.save(aMember().of('acme', 'subject-alan').build());

    await delegations.save(
      aDelegation()
        .identifiedBy('delegation-1')
        .from('subject-grace')
        .to('subject-alan')
        .lending(MemberRight.InviteMembers)
        .between(now, new Date(now.getTime() + 86_400_000))
        .build(),
    );

    const before = application.eventBus.published.length;

    await application.commandBus.execute(new ChangeMemberRoleCommand(as('subject-ada'), 'acme', 'subject-grace', MemberRole.Member));

    expect((await members.findOf('acme', 'subject-grace'))?.role).toBe(MemberRole.Member);
    expect((await delegations.findById('delegation-1'))?.isActiveAt(now)).toBe(false);

    expect(application.eventBus.published.slice(before).map((event) => event.type)).toEqual([
      '{{context.kebab}}.member.role-changed',
      '{{context.kebab}}.delegation.revoked',
    ]);
  });

  it('keeps the last owner of an organisation an owner', async () => {
    const { application, members, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());

    await expect(
      application.commandBus.execute(new ChangeMemberRoleCommand(as('subject-ada'), 'acme', 'subject-ada', MemberRole.Admin)),
    ).rejects.toMatchObject({ code: 'LAST_OWNER' });
  });

  it('refuses a person who is not a member, and an admin who touches an owner', async () => {
    const { application, members, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());
    await members.save(aMember().of('acme', 'subject-grace').as(MemberRole.Admin).build());

    await expect(
      application.commandBus.execute(new ChangeMemberRoleCommand(as('subject-grace'), 'acme', 'subject-nobody', MemberRole.Admin)),
    ).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });

    await expect(
      application.commandBus.execute(new ChangeMemberRoleCommand(as('subject-grace'), 'acme', 'subject-ada', MemberRole.Member)),
    ).rejects.toMatchObject({ code: 'OWNERS_ONLY' });
  });

  it('is refused to a member who does not manage the members', async () => {
    const { application, members, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-alan').build());

    await expect(
      application.commandBus.execute(new ChangeMemberRoleCommand(as('subject-alan'), 'acme', 'subject-alan', MemberRole.Admin)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

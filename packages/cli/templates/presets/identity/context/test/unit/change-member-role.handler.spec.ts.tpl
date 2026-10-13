import { describe, expect, it } from '{{tests.module}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { ChangeMemberRoleCommand } from '{{alias.context}}/application/commands/change-member-role/change-member-role.command{{alias.ext}}';
import { aDelegation } from '{{alias.context}}/test/builders/delegation.builder{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { anOrganisation } from '{{alias.context}}/test/builders/organisation.builder{{alias.ext}}';
import { arrangeIdentity } from '{{alias.context}}/test/unit/identity-application{{alias.ext}}';

const DAY = 86_400_000;

describe('Change member role', () => {
  it('gives the member the new role, tells the other contexts, and ends the delegations they gave', async () => {
    const arranged = arrangeIdentity();
    const { application, members, delegations, as } = arranged;
    const now = application.clock.now();

    await acmeOwnedBy(arranged, 'subject-ada', 'subject-grace');
    await members.save(aMember().of('acme', 'subject-alan').build());

    await delegations.save(
      aDelegation()
        .identifiedBy('delegation-1')
        .from('subject-grace')
        .to('subject-alan')
        .lending(MemberRight.InviteMembers)
        .between(now, new Date(now.getTime() + DAY))
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

  it('never changes the role of who asks: another member does', async () => {
    const arranged = arrangeIdentity();

    await acmeOwnedBy(arranged, 'subject-ada', 'subject-grace');

    await expect(
      arranged.application.commandBus.execute(new ChangeMemberRoleCommand(arranged.as('subject-ada'), 'acme', 'subject-ada', MemberRole.Admin)),
    ).rejects.toMatchObject({ code: 'OWN_ROLE' });
  });

  it('refuses a person who is not a member, and an admin who touches an owner', async () => {
    const arranged = arrangeIdentity();
    const { application, members, as } = arranged;

    await acmeOwnedBy(arranged, 'subject-ada');
    await members.save(aMember().of('acme', 'subject-grace').as(MemberRole.Admin).build());

    await expect(
      application.commandBus.execute(new ChangeMemberRoleCommand(as('subject-grace'), 'acme', 'subject-nobody', MemberRole.Admin)),
    ).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });

    await expect(
      application.commandBus.execute(new ChangeMemberRoleCommand(as('subject-grace'), 'acme', 'subject-ada', MemberRole.Member)),
    ).rejects.toMatchObject({ code: 'OWNERS_ONLY' });
  });

  it('is refused to a member who does not manage the members', async () => {
    const arranged = arrangeIdentity();

    await acmeOwnedBy(arranged, 'subject-ada');
    await arranged.members.save(aMember().of('acme', 'subject-alan').build());
    await arranged.members.save(aMember().of('acme', 'subject-grace').build());

    await expect(
      arranged.application.commandBus.execute(new ChangeMemberRoleCommand(arranged.as('subject-alan'), 'acme', 'subject-grace', MemberRole.Admin)),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Change member role under a delegation', () => {
  it('never turns the delegation into a role: the delegate does not promote themselves', async () => {
    const { application, as } = await delegateOfAlan();

    await expect(
      application.commandBus.execute(new ChangeMemberRoleCommand(as('subject-alan'), 'acme', 'subject-alan', MemberRole.Admin)),
    ).rejects.toMatchObject({ code: 'OWN_ROLE' });
  });

  it('keeps the delegate within their own role: they appoint nobody above it, and touch nobody above it', async () => {
    const { application, as } = await delegateOfAlan();

    await expect(
      application.commandBus.execute(new ChangeMemberRoleCommand(as('subject-alan'), 'acme', 'subject-grace', MemberRole.Admin)),
    ).rejects.toMatchObject({ code: 'ABOVE_OWN_ROLE' });

    await expect(
      application.commandBus.execute(new ChangeMemberRoleCommand(as('subject-alan'), 'acme', 'subject-linus', MemberRole.Member)),
    ).rejects.toMatchObject({ code: 'ABOVE_OWN_ROLE' });
  });
});

/** The organisation `acme`, with an owner of each name given. */
async function acmeOwnedBy(arranged: ReturnType<typeof arrangeIdentity>, ...owners: readonly string[]): Promise<void> {
  await arranged.organisations.save(anOrganisation().identifiedBy('acme').build());

  for (const owner of owners) {
    await arranged.members.save(aMember().of('acme', owner).as(MemberRole.Owner).build());
  }
}

/** A member lent the right to manage the members of acme for a day. */
async function delegateOfAlan(): Promise<ReturnType<typeof arrangeIdentity>> {
  const arranged = arrangeIdentity();
  const now = arranged.application.clock.now();

  await acmeOwnedBy(arranged, 'subject-ada');
  await arranged.members.save(aMember().of('acme', 'subject-alan').build());
  await arranged.members.save(aMember().of('acme', 'subject-grace').build());
  await arranged.members.save(aMember().of('acme', 'subject-linus').as(MemberRole.Admin).build());

  await arranged.delegations.save(
    aDelegation()
      .identifiedBy('delegation-1')
      .from('subject-ada')
      .to('subject-alan')
      .lending(MemberRight.ManageMembers)
      .between(now, new Date(now.getTime() + DAY))
      .build(),
  );

  return arranged;
}

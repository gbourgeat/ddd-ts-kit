import { describe, expect, it } from '{{tests.module}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { GrantDelegationCommand } from '{{alias.context}}/application/commands/grant-delegation/grant-delegation.command{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { arrangeIdentity } from '{{alias.context}}/test/worlds/{{context.kebab}}.world{{alias.ext}}';

const startsAt = new Date('2026-01-01T00:00:00.000Z');
const endsAt = new Date('2026-01-15T00:00:00.000Z');

describe('Grant delegation', () => {
  it('lends a right of the role of the owner to another member for a period, and tells the other contexts', async () => {
    const { application, members, delegations, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());
    await members.save(aMember().of('acme', 'subject-grace').build());

    const before = application.eventBus.published.length;

    const id = await application.commandBus.execute(
      new GrantDelegationCommand(as('subject-ada'), 'acme', lend(MemberRight.InviteMembers)),
    );

    expect((await delegations.findById(id))?.rights).toEqual([MemberRight.InviteMembers]);

    expect(application.eventBus.published.slice(before)).toMatchObject([
      {
        type: '{{context.kebab}}.delegation.granted',
        payload: { delegationId: id, delegatorId: 'subject-ada', delegateId: 'subject-grace', rights: ['invite-members'] },
      },
    ]);
  });

  it('refuses a delegate who is not a member, and a period too long', async () => {
    const { application, members, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());

    await expect(
      application.commandBus.execute(new GrantDelegationCommand(as('subject-ada'), 'acme', lend(MemberRight.InviteMembers))),
    ).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });

    await members.save(aMember().of('acme', 'subject-grace').build());

    const longer = { ...lend(MemberRight.InviteMembers), endsAt: new Date('2026-06-01T00:00:00.000Z') };

    await expect(
      application.commandBus.execute(new GrantDelegationCommand(as('subject-ada'), 'acme', longer)),
    ).rejects.toMatchObject({ code: 'DELEGATION_TOO_LONG' });
  });

  it('is refused to a member whose role does not delegate', async () => {
    const { application, members, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Admin).build());
    await members.save(aMember().of('acme', 'subject-grace').build());

    await expect(
      application.commandBus.execute(new GrantDelegationCommand(as('subject-ada'), 'acme', lend(MemberRight.InviteMembers))),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

function lend(...rights: MemberRight[]): GrantDelegationCommand['terms'] {
  return { delegateId: 'subject-grace', rights, startsAt, endsAt };
}

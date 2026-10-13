import { describe, expect, it } from '{{tests.module}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { InviteMemberCommand } from '{{alias.context}}/application/commands/invite-member/invite-member.command{{alias.ext}}';
import { aDelegation } from '{{alias.context}}/test/builders/delegation.builder{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { arrangeIdentity } from '{{alias.context}}/test/unit/identity-application{{alias.ext}}';

const grace = { email: 'grace@example.test', role: MemberRole.Member };

describe('Invite member', () => {
  it('issues the invitation and answers its token once, keeping only its digest', async () => {
    const { application, members, invitations, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Admin).build());

    const issued = await application.commandBus.execute(new InviteMemberCommand(as('subject-ada'), 'acme', grace));
    const stored = await invitations.findById(issued.id);

    expect(issued.token).toBe('token-1');

    expect(stored?.toState()).toMatchObject({
      organisationId: 'acme',
      tokenHash: 'digest-of-token-1',
      invitedBy: 'subject-ada',
    });
  });

  it('lets a delegate invite with the right lent to them, while the delegation holds', async () => {
    const { application, members, delegations, as } = arrangeIdentity();
    const now = application.clock.now();

    await members.save(aMember().of('acme', 'subject-grace').build());

    await delegations.save(
      aDelegation()
        .to('subject-grace')
        .lending(MemberRight.InviteMembers)
        .between(now, new Date(now.getTime() + 86_400_000))
        .build(),
    );

    await expect(
      application.commandBus.execute(
        new InviteMemberCommand(as('subject-grace'), 'acme', { ...grace, email: 'alan@example.test' }),
      ),
    ).resolves.toMatchObject({ token: 'token-1' });
  });

  it('is refused to a member whose role does not invite, and to a stranger to the organisation', async () => {
    const { application, members, invitations, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-alan').as(MemberRole.Member).build());

    for (const actor of [as('subject-alan'), as('subject-mallory')]) {
      await expect(application.commandBus.execute(new InviteMemberCommand(actor, 'acme', grace))).rejects.toMatchObject(
        {
          code: 'FORBIDDEN',
        },
      );
    }

    expect(invitations.all()).toEqual([]);
  });

  it('lets an owner only invite an owner', async () => {
    const { application, members, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Admin).build());

    await expect(
      application.commandBus.execute(
        new InviteMemberCommand(as('subject-ada'), 'acme', { ...grace, role: MemberRole.Owner }),
      ),
    ).rejects.toMatchObject({ code: 'OWNERS_ONLY' });
  });
});

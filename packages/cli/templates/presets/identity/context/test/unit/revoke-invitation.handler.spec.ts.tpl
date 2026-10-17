import { describe, expect, it } from '{{tests.module}}';
import { InvitationStatus } from '{{alias.context}}/domain/vocabularies/invitation-status.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { RevokeInvitationCommand } from '{{alias.context}}/application/commands/revoke-invitation/revoke-invitation.command{{alias.ext}}';
import { anInvitation } from '{{alias.context}}/test/builders/invitation.builder{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { arrangeIdentity } from '{{alias.context}}/test/worlds/{{context.kebab}}.world{{alias.ext}}';

describe('Revoke invitation', () => {
  it('takes back an invitation of the organisation', async () => {
    const { application, members, invitations, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Admin).build());
    await invitations.save(anInvitation().identifiedBy('invitation-1').to('acme').build());

    await application.commandBus.execute(new RevokeInvitationCommand(as('subject-ada'), 'acme', 'invitation-1'));

    expect((await invitations.findById('invitation-1'))?.status).toBe(InvitationStatus.Revoked);
  });

  it('finds no invitation of another organisation, and none that does not exist', async () => {
    const { application, members, invitations, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Admin).build());
    await invitations.save(anInvitation().identifiedBy('invitation-1').to('globex').build());

    for (const invitationId of ['invitation-1', 'invitation-9']) {
      await expect(
        application.commandBus.execute(new RevokeInvitationCommand(as('subject-ada'), 'acme', invitationId)),
      ).rejects.toMatchObject({ code: 'INVITATION_NOT_FOUND' });
    }
  });

  it('is refused to a member whose role does not invite', async () => {
    const { application, members, invitations, as } = arrangeIdentity();

    await members.save(aMember().of('acme', 'subject-alan').build());
    await invitations.save(anInvitation().identifiedBy('invitation-1').to('acme').build());

    await expect(
      application.commandBus.execute(new RevokeInvitationCommand(as('subject-alan'), 'acme', 'invitation-1')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

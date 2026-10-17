import { describe, expect, it } from '{{tests.module}}';
import { InvitationStatus } from '{{alias.context}}/domain/vocabularies/invitation-status.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { AcceptInvitationCommand } from '{{alias.context}}/application/commands/accept-invitation/accept-invitation.command{{alias.ext}}';
import { anAccount } from '{{alias.context}}/test/builders/account.builder{{alias.ext}}';
import { anInvitation } from '{{alias.context}}/test/builders/invitation.builder{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { arrangeIdentity, startedIdentity } from '{{alias.context}}/test/worlds/{{context.kebab}}.world{{alias.ext}}';

describe('Accept invitation', () => {
  it('makes the person it was sent to a member, in its role, and tells the provider and the other contexts', async () => {
    const { application, accounts, invitations, members, identityProvider, tokens, as } = await startedIdentity();
    const token = tokens.issue();

    await accounts.save(anAccount().identifiedBy('subject-grace').reachedAt('grace@example.test').build());

    await invitations.save(
      anInvitation().identifiedBy('invitation-1').to('acme').as(MemberRole.Admin).withTokenHash(token.digest).build(),
    );

    await application.commandBus.execute(new AcceptInvitationCommand(as('subject-grace'), token.token));

    expect((await members.findOf('acme', 'subject-grace'))?.role).toBe(MemberRole.Admin);
    expect((await invitations.findById('invitation-1'))?.status).toBe(InvitationStatus.Accepted);
    expect(identityProvider.asked).toEqual(['add subject-grace to acme']);
    expect(application.eventBus.published).toMatchObject([{ type: '{{context.kebab}}.member.joined' }]);
  });

  it('knows no token it did not issue, and no person who never signed in', async () => {
    const { application, invitations, tokens, as } = arrangeIdentity();
    const token = tokens.issue();

    await invitations.save(anInvitation().withTokenHash(token.digest).build());

    await expect(
      application.commandBus.execute(new AcceptInvitationCommand(as('subject-grace'), 'forged')),
    ).rejects.toMatchObject({
      code: 'INVITATION_NOT_FOUND',
    });

    await expect(
      application.commandBus.execute(new AcceptInvitationCommand(as('subject-ghost'), token.token)),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
  });

  it('refuses another person than the one it was sent to, and a member already there', async () => {
    const { application, accounts, invitations, members, tokens, as } = arrangeIdentity();
    const token = tokens.issue();

    await accounts.save(anAccount().identifiedBy('subject-alan').reachedAt('alan@example.test').build());
    await accounts.save(anAccount().identifiedBy('subject-grace').reachedAt('grace@example.test').build());
    await invitations.save(anInvitation().to('acme').withTokenHash(token.digest).build());
    await members.save(aMember().of('acme', 'subject-grace').build());

    await expect(
      application.commandBus.execute(new AcceptInvitationCommand(as('subject-alan'), token.token)),
    ).rejects.toMatchObject({
      code: 'INVITATION_ADDRESSED_TO_ANOTHER',
    });

    await expect(
      application.commandBus.execute(new AcceptInvitationCommand(as('subject-grace'), token.token)),
    ).rejects.toMatchObject({
      code: 'ALREADY_MEMBER',
    });
  });
});

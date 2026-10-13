import { describe, expect, it } from '{{tests.module}}';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { RemoveMemberCommand } from '{{alias.context}}/application/commands/remove-member/remove-member.command{{alias.ext}}';
import { aDelegation } from '{{alias.context}}/test/builders/delegation.builder{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { anOrganisation } from '{{alias.context}}/test/builders/organisation.builder{{alias.ext}}';
import { arrangeIdentity } from '{{alias.context}}/test/unit/identity-application{{alias.ext}}';

const DAY = 86_400_000;

describe('Remove member', () => {
  it('removes the member, ends every delegation they gave or received, and tells the provider and the other contexts', async () => {
    const { application, organisations, members, delegations, identityProvider, as } = arrangeIdentity();
    const now = application.clock.now();

    await organisations.save(anOrganisation().identifiedBy('acme').build());
    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Admin).build());
    await members.save(aMember().of('acme', 'subject-alan').build());

    await delegations.save(
      aDelegation()
        .identifiedBy('delegation-1')
        .to('subject-alan')
        .lending(MemberRight.InviteMembers)
        .between(now, new Date(now.getTime() + DAY))
        .build(),
    );

    // Started once the organisation is arranged: what the provider is asked from now on follows the removal alone.
    await application.start();

    const before = application.eventBus.published.length;

    await application.commandBus.execute(new RemoveMemberCommand(as('subject-ada'), 'acme', 'subject-alan'));

    expect(await members.findOf('acme', 'subject-alan')).toBeUndefined();
    expect((await delegations.findById('delegation-1'))?.isActiveAt(now)).toBe(false);
    expect(identityProvider.asked).toEqual(['remove subject-alan from acme']);

    expect(application.eventBus.published.slice(before).map((event) => event.type)).toEqual([
      '{{context.kebab}}.member.removed',
      '{{context.kebab}}.delegation.revoked',
    ]);
  });

  it('refuses a person who is not a member, and keeps the last owner', async () => {
    const { application, organisations, members, as } = arrangeIdentity();

    await organisations.save(anOrganisation().identifiedBy('acme').build());
    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());

    await expect(
      application.commandBus.execute(new RemoveMemberCommand(as('subject-ada'), 'acme', 'subject-nobody')),
    ).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });

    await expect(
      application.commandBus.execute(new RemoveMemberCommand(as('subject-ada'), 'acme', 'subject-ada')),
    ).rejects.toMatchObject({ code: 'LAST_OWNER' });
  });

  it('is refused to a member who does not manage the members', async () => {
    const { application, organisations, members, as } = arrangeIdentity();

    await organisations.save(anOrganisation().identifiedBy('acme').build());
    await members.save(aMember().of('acme', 'subject-alan').build());
    await members.save(aMember().of('acme', 'subject-grace').build());

    await expect(
      application.commandBus.execute(new RemoveMemberCommand(as('subject-alan'), 'acme', 'subject-grace')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Remove member under a delegation', () => {
  it('removes within the role of the delegate, never above it, and names the delegation used', async () => {
    const { application, organisations, members, delegations, as } = arrangeIdentity();
    const now = application.clock.now();

    await organisations.save(anOrganisation().identifiedBy('acme').build());
    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());
    await members.save(aMember().of('acme', 'subject-alan').build());
    await members.save(aMember().of('acme', 'subject-irene').build());
    await members.save(aMember().of('acme', 'subject-linus').as(MemberRole.Admin).build());

    await delegations.save(
      aDelegation()
        .identifiedBy('delegation-1')
        .from('subject-ada')
        .to('subject-alan')
        .lending(MemberRight.ManageMembers)
        .between(now, new Date(now.getTime() + DAY))
        .build(),
    );

    await expect(
      application.commandBus.execute(new RemoveMemberCommand(as('subject-alan'), 'acme', 'subject-linus')),
    ).rejects.toMatchObject({ code: 'ABOVE_OWN_ROLE' });

    await application.commandBus.execute(new RemoveMemberCommand(as('subject-alan'), 'acme', 'subject-irene'));

    expect(application.eventBus.published.at(-1)).toMatchObject({
      type: '{{context.kebab}}.member.removed',
      payload: { accountId: 'subject-irene', delegationId: 'delegation-1' },
    });
  });
});

describe('Two owners who remove each other at once', () => {
  it('cannot both commit: the organisation keeps an owner, and the second change is refused as a conflict', async () => {
    const { application, organisations, members, as } = arrangeIdentity();

    await organisations.save(anOrganisation().identifiedBy('acme').build());
    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());
    await members.save(aMember().of('acme', 'subject-grace').as(MemberRole.Owner).build());

    const outcomes = await Promise.allSettled([
      application.commandBus.execute(new RemoveMemberCommand(as('subject-ada'), 'acme', 'subject-grace')),
      application.commandBus.execute(new RemoveMemberCommand(as('subject-grace'), 'acme', 'subject-ada')),
    ]);

    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(await members.countOwners('acme')).toBe(1);
  });
});

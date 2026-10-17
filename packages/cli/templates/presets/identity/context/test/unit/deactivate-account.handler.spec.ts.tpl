import { describe, expect, it } from '{{tests.module}}';
import { offsetPage } from '@ddd-ts-kit/kernel';
import { MemberRight } from '{{alias.context}}/domain/vocabularies/member-right.vocabulary{{alias.ext}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';
import { InviteMemberCommand } from '{{alias.context}}/application/commands/invite-member/invite-member.command{{alias.ext}}';
import { RemoveMemberCommand } from '{{alias.context}}/application/commands/remove-member/remove-member.command{{alias.ext}}';
import { SearchMembersQuery } from '{{alias.context}}/application/queries/search-members/search-members.query{{alias.ext}}';
import { anAccount } from '{{alias.context}}/test/builders/account.builder{{alias.ext}}';
import { aDelegation } from '{{alias.context}}/test/builders/delegation.builder{{alias.ext}}';
import { aMember } from '{{alias.context}}/test/builders/member.builder{{alias.ext}}';
import { anOrganisation } from '{{alias.context}}/test/builders/organisation.builder{{alias.ext}}';
import { arrangeIdentity, startedIdentity } from '{{alias.context}}/test/worlds/{{context.kebab}}.world{{alias.ext}}';

const DAY = 86_400_000;

describe('Deactivate account', () => {
  it('deactivates the account of the person who asks, tells the other contexts, then the provider', async () => {
    const { application, accounts, identityProvider, as } = await startedIdentity();

    await accounts.save(anAccount().identifiedBy('subject-ada').build());
    await application.commandBus.execute(new DeactivateAccountCommand(as('subject-ada')));

    expect((await accounts.findById('subject-ada'))?.isActive).toBe(false);
    expect(identityProvider.asked).toEqual(['disable subject-ada']);

    expect(application.eventBus.published).toMatchObject([
      { type: '{{context.kebab}}.account.deactivated', payload: { accountId: 'subject-ada' } },
    ]);
  });

  it('leaves every organisation and ends every delegation, so that the account holds no right anywhere', async () => {
    const { application, accounts, organisations, members, delegations, as } = arrangeIdentity();
    const now = application.clock.now();

    await accounts.save(anAccount().identifiedBy('subject-grace').build());

    for (const slug of ['acme', 'globex']) {
      await organisations.save(anOrganisation().identifiedBy(slug).build());
      await members.save(aMember().of(slug, 'subject-ada').as(MemberRole.Owner).build());
      await members.save(aMember().of(slug, 'subject-grace').as(MemberRole.Admin).build());
    }

    await delegations.save(
      aDelegation()
        .identifiedBy('delegation-1')
        .in('acme')
        .from('subject-ada')
        .to('subject-grace')
        .lending(MemberRight.GrantDelegations)
        .between(now, new Date(now.getTime() + DAY))
        .build(),
    );

    await application.commandBus.execute(new DeactivateAccountCommand(as('subject-grace')));

    expect(await members.searchCurrentOf('subject-grace')).toEqual([]);
    expect((await delegations.findById('delegation-1'))?.isActiveAt(now)).toBe(false);
  });

  it('leaves a deactivated person no use case of an organisation, whatever their token still says', async () => {
    const { application, accounts, organisations, members, as } = arrangeIdentity();

    await accounts.save(anAccount().identifiedBy('subject-grace').build());
    await organisations.save(anOrganisation().identifiedBy('acme').build());
    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());
    await members.save(aMember().of('acme', 'subject-grace').as(MemberRole.Owner).build());
    await members.save(aMember().of('acme', 'subject-alan').build());
    await application.commandBus.execute(new DeactivateAccountCommand(as('subject-grace')));

    const invite = new InviteMemberCommand(as('subject-grace'), 'acme', { email: 'eve@example.test', role: MemberRole.Member });
    const remove = new RemoveMemberCommand(as('subject-grace'), 'acme', 'subject-alan');
    const search = new SearchMembersQuery(as('subject-grace'), 'acme', offsetPage({ limit: 20 }));

    await expect(application.commandBus.execute(invite)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(application.commandBus.execute(remove)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(application.queryBus.execute(search)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await members.countOwners('acme')).toBe(1);
  });

  it('refuses the last owner of an organisation, who appoints another owner first, and changes nothing', async () => {
    const { application, accounts, organisations, members, as } = arrangeIdentity();

    await accounts.save(anAccount().identifiedBy('subject-ada').build());
    await organisations.save(anOrganisation().identifiedBy('acme').build());
    await members.save(aMember().of('acme', 'subject-ada').as(MemberRole.Owner).build());

    await expect(application.commandBus.execute(new DeactivateAccountCommand(as('subject-ada')))).rejects.toMatchObject(
      {
        code: 'LAST_OWNER',
      },
    );

    expect((await accounts.findById('subject-ada'))?.isActive).toBe(true);
  });

  it('refuses a person who never signed in', async () => {
    const { application, as } = arrangeIdentity();

    await expect(
      application.commandBus.execute(new DeactivateAccountCommand(as('subject-ghost'))),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
  });
});

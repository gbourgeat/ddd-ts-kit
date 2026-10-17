import { describe, expect, it } from '{{tests.module}}';
import { MemberRole } from '{{alias.context}}/domain/vocabularies/member-role.vocabulary{{alias.ext}}';
import { OpenOrganisationCommand } from '{{alias.context}}/application/commands/open-organisation/open-organisation.command{{alias.ext}}';
import { anAccount } from '{{alias.context}}/test/builders/account.builder{{alias.ext}}';
import { anOrganisation } from '{{alias.context}}/test/builders/organisation.builder{{alias.ext}}';
import { arrangeIdentity, startedIdentity } from '{{alias.context}}/test/worlds/{{context.kebab}}.world{{alias.ext}}';

const acme = { slug: 'acme', name: 'Acme' };

describe('Open organisation', () => {
  it('opens the organisation under its slug, its opener its first owner, and tells the provider and the other contexts', async () => {
    const { application, accounts, members, identityProvider, as } = await startedIdentity();

    await accounts.save(anAccount().identifiedBy('subject-ada').build());

    const id = await application.commandBus.execute(new OpenOrganisationCommand(as('subject-ada'), acme));

    expect(id).toBe('acme');
    expect((await members.findOf('acme', 'subject-ada'))?.role).toBe(MemberRole.Owner);
    expect(identityProvider.asked).toEqual(['open acme named Acme', 'add subject-ada to acme']);

    expect(application.eventBus.published.map((event) => event.type)).toEqual([
      '{{context.kebab}}.organisation.opened',
      '{{context.kebab}}.member.joined',
    ]);
  });

  it('refuses a slug another organisation holds, and saves nothing', async () => {
    const { application, accounts, organisations, members, as } = arrangeIdentity();

    await accounts.save(anAccount().identifiedBy('subject-ada').build());
    await organisations.save(anOrganisation().identifiedBy('acme').build());

    await expect(
      application.commandBus.execute(new OpenOrganisationCommand(as('subject-ada'), acme)),
    ).rejects.toMatchObject({
      code: 'ORGANISATION_SLUG_TAKEN',
    });

    expect(members.all()).toEqual([]);
  });

  it('refuses a person who never signed in', async () => {
    const { application, as } = arrangeIdentity();

    await expect(
      application.commandBus.execute(new OpenOrganisationCommand(as('subject-ghost'), acme)),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
  });
});

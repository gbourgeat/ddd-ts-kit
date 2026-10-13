import { describe, expect, it } from '{{tests.module}}';
import { OrganisationOpenedEventHandler } from '{{alias.context}}/application/event-handlers/organisation-opened.event-handler{{alias.ext}}';
import { OrganisationOpened } from '{{alias.context}}/domain/events/organisation-opened.event{{alias.ext}}';
import { FakeIdentityProviderAdmin } from '{{alias.context}}/test/fakes/identity-provider-admin.fake{{alias.ext}}';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('When the fact is committed, the identity provider follows', () => {
  it('asks the provider once', async () => {
    const provider = new FakeIdentityProviderAdmin();

    await new OrganisationOpenedEventHandler(provider).handle(
      new OrganisationOpened('acme', at, { name: 'Acme', openedBy: 'subject-ada' }),
    );

    expect(provider.asked).toEqual(['open acme named Acme']);
  });

  it('lets the failure of the provider through, for the platform to report', async () => {
    const provider = new FakeIdentityProviderAdmin();

    provider.failWith(new Error('provider unreachable'));

    await expect(
      new OrganisationOpenedEventHandler(provider).handle(
        new OrganisationOpened('acme', at, { name: 'Acme', openedBy: 'subject-ada' }),
      ),
    ).rejects.toThrow('provider unreachable');
  });
});

import { describe, expect, it } from '{{tests.module}}';
import { AccountDeactivatedEventHandler } from '{{alias.context}}/application/event-handlers/account-deactivated.event-handler{{alias.ext}}';
import { AccountDeactivated } from '{{alias.context}}/domain/events/account-deactivated.event{{alias.ext}}';
import { FakeIdentityProviderAdmin } from '{{alias.context}}/test/fakes/identity-provider-admin.fake{{alias.ext}}';

const at = new Date('2026-01-01T00:00:00.000Z');

describe('When the fact is committed, the identity provider follows', () => {
  it('asks the provider once', async () => {
    const provider = new FakeIdentityProviderAdmin();

    await new AccountDeactivatedEventHandler(provider).handle(new AccountDeactivated('subject-ada', at));

    expect(provider.asked).toEqual(['disable subject-ada']);
  });

  it('lets the failure of the provider through, for the platform to report', async () => {
    const provider = new FakeIdentityProviderAdmin();

    provider.failWith(new Error('provider unreachable'));

    await expect(
      new AccountDeactivatedEventHandler(provider).handle(new AccountDeactivated('subject-ada', at)),
    ).rejects.toThrow('provider unreachable');
  });
});

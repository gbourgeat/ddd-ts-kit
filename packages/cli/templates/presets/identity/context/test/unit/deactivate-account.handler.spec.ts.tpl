import { describe, expect, it } from '{{tests.module}}';
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';
import { anAccount } from '{{alias.context}}/test/builders/account.builder{{alias.ext}}';
import { arrangeIdentity } from '{{alias.context}}/test/unit/identity-application{{alias.ext}}';

describe('Deactivate account', () => {
  it('deactivates the account of the person who asks, tells the other contexts, then the provider', async () => {
    const { application, accounts, identityProvider, as } = arrangeIdentity();

    await accounts.save(anAccount().identifiedBy('subject-ada').build());
    await application.commandBus.execute(new DeactivateAccountCommand(as('subject-ada')));

    expect((await accounts.findById('subject-ada'))?.isActive).toBe(false);
    expect(identityProvider.asked).toEqual(['disable subject-ada']);

    expect(application.eventBus.published).toMatchObject([
      { type: '{{context.kebab}}.account.deactivated', payload: { accountId: 'subject-ada' } },
    ]);
  });

  it('refuses a person who never signed in', async () => {
    const { application, as } = arrangeIdentity();

    await expect(
      application.commandBus.execute(new DeactivateAccountCommand(as('subject-ghost'))),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
  });

  it('keeps the decision when the provider fails: its failure is reported, never the command', async () => {
    const { application, accounts, identityProvider, as } = arrangeIdentity();

    await accounts.save(anAccount().identifiedBy('subject-ada').build());
    identityProvider.failWith(new Error('provider unreachable'));
    await application.commandBus.execute(new DeactivateAccountCommand(as('subject-ada')));

    expect((await accounts.findById('subject-ada'))?.isActive).toBe(false);
    expect(application.errors.reports).toHaveLength(1);
  });
});

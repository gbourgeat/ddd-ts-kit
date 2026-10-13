import { describe, expect, it } from '{{tests.module}}';
import { ProvisionAccountCommand } from '{{alias.context}}/application/commands/provision-account/provision-account.command{{alias.ext}}';
import { anAccount } from '{{alias.context}}/test/builders/account.builder{{alias.ext}}';
import { arrangeIdentity } from '{{alias.context}}/test/unit/identity-application{{alias.ext}}';

const profile = { email: 'Ada@Example.test', emailVerified: true, displayName: 'Ada Lovelace' };

describe('Provision account', () => {
  it('provisions the account of a person at their first sign-in, under their subject', async () => {
    const { application, accounts, as } = arrangeIdentity();

    const id = await application.commandBus.execute(new ProvisionAccountCommand(as('subject-ada'), profile));

    expect(id).toBe('subject-ada');
    expect((await accounts.findById(id))?.email.value).toBe('ada@example.test');
  });

  it('refreshes the profile at a later sign-in, without a second account', async () => {
    const { application, accounts, as } = arrangeIdentity();

    await accounts.save(anAccount().identifiedBy('subject-ada').reachedAt('old@example.test').build());
    await application.commandBus.execute(new ProvisionAccountCommand(as('subject-ada'), profile));

    expect(accounts.all().map((account) => account.email.value)).toEqual(['ada@example.test']);
  });

  it('refuses a profile the token carries no address in, and a deactivated account', async () => {
    const { application, accounts, as } = arrangeIdentity();

    await expect(
      application.commandBus.execute(new ProvisionAccountCommand(as('subject-ada'), { ...profile, email: 'nobody' })),
    ).rejects.toMatchObject({ code: 'INVALID_EMAIL_ADDRESS' });

    await accounts.save(anAccount().identifiedBy('subject-alan').deactivatedAt(new Date('2025-12-01T00:00:00.000Z')).build());

    await expect(
      application.commandBus.execute(new ProvisionAccountCommand(as('subject-alan'), profile)),
    ).rejects.toMatchObject({ code: 'ACCOUNT_DEACTIVATED' });
  });

  it('refuses an address the provider has not verified, at the first sign-in as at a later one', async () => {
    const { application, accounts, as } = arrangeIdentity();
    const unverified = { ...profile, emailVerified: false };

    await expect(
      application.commandBus.execute(new ProvisionAccountCommand(as('subject-ada'), unverified)),
    ).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });

    await accounts.save(anAccount().identifiedBy('subject-alan').reachedAt('alan@example.test').build());

    await expect(
      application.commandBus.execute(new ProvisionAccountCommand(as('subject-alan'), unverified)),
    ).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });

    expect(accounts.all().map((account) => account.email.value)).toEqual(['alan@example.test']);
  });

  it('is refused to an actor the platform grants nothing', async () => {
    const { application, stranger } = arrangeIdentity();

    await expect(application.commandBus.execute(new ProvisionAccountCommand(stranger, profile))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

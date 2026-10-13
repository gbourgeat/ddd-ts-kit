import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Account } from '{{alias.context}}/domain/aggregates/account.aggregate{{alias.ext}}';
import type { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
import { DisplayName } from '{{alias.context}}/domain/value-objects/display-name.vo{{alias.ext}}';
import { EmailAddress } from '{{alias.context}}/domain/value-objects/email-address.vo{{alias.ext}}';
import { ProvisionAccountCommand } from '{{alias.context}}/application/commands/provision-account/provision-account.command{{alias.ext}}';

@CommandHandler(ProvisionAccountCommand)
export class ProvisionAccountHandler implements CommandHandler<ProvisionAccountCommand> {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly clock: Clock,
  ) {}

  /** The actor is the person the provider authenticated: their subject names the account, at the first sign-in as at the next ones. */
  async execute({ actor, profile }: ProvisionAccountCommand): Promise<string> {
    const current = { email: EmailAddress.create(profile.email), displayName: DisplayName.create(profile.displayName) };
    const known = await this.accountRepository.findById(actor.id);

    if (known === undefined) {
      await this.accountRepository.save(Account.provision(actor.id, current, this.clock.now()));

      return actor.id;
    }

    known.refreshProfile(current);
    await this.accountRepository.save(known);

    return known.id;
  }
}

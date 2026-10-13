import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { AccountError } from '{{alias.context}}/domain/errors/account.error{{alias.ext}}';
import type { AccountRepository } from '{{alias.context}}/domain/repositories/account.repository{{alias.ext}}';
import { DeactivateAccountCommand } from '{{alias.context}}/application/commands/deactivate-account/deactivate-account.command{{alias.ext}}';

@CommandHandler(DeactivateAccountCommand)
export class DeactivateAccountHandler implements CommandHandler<DeactivateAccountCommand> {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly clock: Clock,
  ) {}

  /** A person deactivates their own account; the provider is asked to disable them once it is committed. */
  async execute({ actor }: DeactivateAccountCommand): Promise<string> {
    const account = await this.accountRepository.findById(actor.id);

    if (account === undefined) {
      throw AccountError.notFound(actor.id);
    }

    account.deactivate(this.clock.now());
    await this.accountRepository.save(account);

    return account.id;
  }
}

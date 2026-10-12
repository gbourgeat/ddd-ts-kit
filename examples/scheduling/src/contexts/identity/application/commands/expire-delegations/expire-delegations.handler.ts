import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { DelegationRepository } from '@/contexts/identity/domain/repositories/delegation.repository';
import { ExpireDelegationsCommand } from '@/contexts/identity/application/commands/expire-delegations/expire-delegations.command';

@CommandHandler(ExpireDelegationsCommand)
export class ExpireDelegationsHandler implements CommandHandler<ExpireDelegationsCommand> {
  constructor(private readonly delegationRepository: DelegationRepository) {}

  async execute(command: ExpireDelegationsCommand): Promise<void> {
    const due = await this.delegationRepository.findDueAt(command.at);

    for (const target of due) {
      target.expire(command.at);

      await this.delegationRepository.save(target);
    }
  }
}

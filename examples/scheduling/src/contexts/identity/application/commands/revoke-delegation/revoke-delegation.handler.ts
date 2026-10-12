import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { DelegationError } from '@/contexts/identity/domain/errors/delegation.error';
import type { DelegationRepository } from '@/contexts/identity/domain/repositories/delegation.repository';
import { Desk } from '@/contexts/identity/domain/value-objects/desk.vo';
import { RevokeDelegationCommand } from '@/contexts/identity/application/commands/revoke-delegation/revoke-delegation.command';

@CommandHandler(RevokeDelegationCommand)
export class RevokeDelegationHandler implements CommandHandler<RevokeDelegationCommand> {
  constructor(
    private readonly delegationRepository: DelegationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: RevokeDelegationCommand): Promise<string> {
    const target = await this.delegationRepository.findById(command.delegationId);

    // The right was decided on the desk of the path: a delegation of another desk is not there to be found.
    if (!target?.isOn(Desk.create(command.desk.practiceId, command.desk.practitionerId))) {
      throw DelegationError.notFound(command.delegationId);
    }

    target.revoke(this.clock.now());

    await this.delegationRepository.save(target);

    return target.id;
  }
}

import { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { DelegationNotFoundError } from '#src/contexts/identity/domain/errors/delegation-not-found.error.js';
import { DelegationRepository } from '#src/contexts/identity/domain/repositories/delegation.repository.js';
import { Desk } from '#src/contexts/identity/domain/value-objects/desk.vo.js';
import { RevokeDelegationCommand } from '#src/contexts/identity/application/commands/revoke-delegation/revoke-delegation.command.js';

@CommandHandler(RevokeDelegationCommand, [DelegationRepository, Clock])
export class RevokeDelegationHandler implements CommandHandler<RevokeDelegationCommand> {
  constructor(
    private readonly delegationRepository: DelegationRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: RevokeDelegationCommand): Promise<string> {
    const target = await this.delegationRepository.findById(command.delegationId);

    // The right was decided on the desk of the path: a delegation of another desk is not there to be found.
    if (!target?.isOn(Desk.create(command.desk.practiceId, command.desk.practitionerId))) {
      throw new DelegationNotFoundError(command.delegationId);
    }

    target.revoke(this.clock.now());

    await this.delegationRepository.save(target);

    return target.id;
  }
}

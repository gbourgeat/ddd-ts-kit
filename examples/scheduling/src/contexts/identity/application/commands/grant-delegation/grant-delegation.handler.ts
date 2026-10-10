import { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Delegation } from '@/contexts/identity/domain/aggregates/delegation.aggregate.js';
import { DelegationAlreadyActiveError } from '@/contexts/identity/domain/errors/delegation-already-active.error.js';
import { PracticeNotFoundError } from '@/contexts/identity/domain/errors/practice-not-found.error.js';
import { DelegationRepository } from '@/contexts/identity/domain/repositories/delegation.repository.js';
import { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository.js';
import { GrantDelegationCommand } from '@/contexts/identity/application/commands/grant-delegation/grant-delegation.command.js';

@CommandHandler(GrantDelegationCommand, [DelegationRepository, PracticeRepository, IdGenerator, Clock])
export class GrantDelegationHandler implements CommandHandler<GrantDelegationCommand> {
  constructor(
    private readonly delegationRepository: DelegationRepository,
    private readonly practiceRepository: PracticeRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: GrantDelegationCommand): Promise<string> {
    const practice = await this.practiceRepository.findById(command.desk.practiceId);

    if (practice === undefined) {
      throw new PracticeNotFoundError(command.desk.practiceId);
    }

    const desk = practice.deskOf(command.desk.practitionerId);
    const assistantId = practice.assistant(command.terms.assistantId).personId;
    const active = await this.delegationRepository.findActiveBetween(desk, assistantId);

    if (active !== undefined) {
      throw new DelegationAlreadyActiveError(active.id);
    }

    const terms = {
      desk,
      assistantId,
      availabilityIncluded: command.terms.availabilityIncluded,
      endsAt: command.terms.endsAt,
    };

    const target = Delegation.create(this.ids.next(), terms, this.clock.now());

    await this.delegationRepository.save(target);

    return target.id;
  }
}

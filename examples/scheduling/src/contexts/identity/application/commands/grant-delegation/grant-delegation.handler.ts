import type { Clock, IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Delegation } from '@/contexts/identity/domain/aggregates/delegation.aggregate';
import { DelegationAlreadyActive } from '@/contexts/identity/domain/errors/delegation-already-active.error';
import { UnknownPractice } from '@/contexts/identity/domain/errors/unknown-practice.error';
import type { DelegationRepository } from '@/contexts/identity/domain/repositories/delegation.repository';
import type { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository';
import { GrantDelegationCommand } from '@/contexts/identity/application/commands/grant-delegation/grant-delegation.command';

@CommandHandler(GrantDelegationCommand)
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
      throw UnknownPractice.forPractice(command.desk.practiceId);
    }

    const desk = practice.deskOf(command.desk.practitionerId);
    const assistantId = practice.assistant(command.terms.assistantId).personId;
    const active = await this.delegationRepository.findActiveBetween(desk, assistantId);

    if (active !== undefined) {
      throw DelegationAlreadyActive.forDelegation(active.id);
    }

    const terms = {
      desk,
      assistantId,
      availabilityIncluded: command.terms.availabilityIncluded,
      endsAt: command.terms.endsAt,
    };

    const delegation = Delegation.create(this.ids.next(), terms, this.clock.now());

    await this.delegationRepository.save(delegation);

    return delegation.id;
  }
}

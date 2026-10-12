import { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { PracticeNotFoundError } from '@/contexts/identity/domain/errors/practice-not-found.error';
import { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository';
import { RemoveMemberCommand } from '@/contexts/identity/application/commands/remove-member/remove-member.command';

@CommandHandler(RemoveMemberCommand)
export class RemoveMemberHandler implements CommandHandler<RemoveMemberCommand> {
  constructor(
    private readonly practiceRepository: PracticeRepository,
    private readonly clock: Clock,
  ) {}

  /** Answers the identifier of the person who is no longer a member. */
  async execute(command: RemoveMemberCommand): Promise<string> {
    const target = await this.practiceRepository.findById(command.practiceId);

    if (target === undefined) {
      throw new PracticeNotFoundError(command.practiceId);
    }

    target.removeMember(command.personId, this.clock.now());

    await this.practiceRepository.save(target);

    return command.personId;
  }
}

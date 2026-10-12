import type { Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { PracticeError } from '@/contexts/identity/domain/errors/practice.error';
import type { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository';
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
      throw PracticeError.notFound(command.practiceId);
    }

    target.removeMember(command.personId, this.clock.now());

    await this.practiceRepository.save(target);

    return command.personId;
  }
}

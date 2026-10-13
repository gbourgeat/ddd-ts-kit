import { type Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { PersonError } from '@/contexts/identity/domain/errors/person.error';
import { PracticeError } from '@/contexts/identity/domain/errors/practice.error';
import type { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
import type { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository';
import { Role } from '@/contexts/identity/domain/value-objects/role.vo';
import { AddMemberCommand } from '@/contexts/identity/application/commands/add-member/add-member.command';

@CommandHandler(AddMemberCommand)
export class AddMemberHandler implements CommandHandler<AddMemberCommand> {
  constructor(
    private readonly practiceRepository: PracticeRepository,
    private readonly personRepository: PersonRepository,
    private readonly clock: Clock,
  ) {}

  /** Answers the identifier of the person who is now a member. */
  async execute(command: AddMemberCommand): Promise<string> {
    const role = Role.create(command.member.role);
    const practice = await this.practiceRepository.findById(command.practiceId);
    const person = await this.personRepository.findById(command.member.personId);

    if (practice === undefined) {
      throw PracticeError.notFound(command.practiceId);
    }

    if (person === undefined) {
      throw PersonError.notRegistered(command.member.personId);
    }

    practice.addMember({ personId: person.id, role, displayName: person.displayName }, this.clock.now());

    await this.practiceRepository.save(practice);

    return person.id;
  }
}

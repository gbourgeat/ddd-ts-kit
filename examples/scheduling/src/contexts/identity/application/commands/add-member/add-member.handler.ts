import { Clock, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { PersonNotRegisteredError } from '@/contexts/identity/domain/errors/person-not-registered.error';
import { PracticeNotFoundError } from '@/contexts/identity/domain/errors/practice-not-found.error';
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
import { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository';
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
    const role = unwrap(Role.create(command.member.role));
    const target = await this.practiceRepository.findById(command.practiceId);
    const person = await this.personRepository.findById(command.member.personId);

    if (target === undefined) {
      throw new PracticeNotFoundError(command.practiceId);
    }

    if (person === undefined) {
      throw new PersonNotRegisteredError(command.member.personId);
    }

    target.addMember({ personId: person.id, role, displayName: person.displayName }, this.clock.now());

    await this.practiceRepository.save(target);

    return person.id;
  }
}

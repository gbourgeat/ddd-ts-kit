import { Clock, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { PersonNotRegisteredError } from '../../../domain/errors/person-not-registered.error.js';
import { PracticeNotFoundError } from '../../../domain/errors/practice-not-found.error.js';
import { PersonRepository } from '../../../domain/repositories/person.repository.js';
import { PracticeRepository } from '../../../domain/repositories/practice.repository.js';
import { Role } from '../../../domain/value-objects/role.vo.js';
import { AddMemberCommand } from './add-member.command.js';

@CommandHandler(AddMemberCommand, [PracticeRepository, PersonRepository, Clock])
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

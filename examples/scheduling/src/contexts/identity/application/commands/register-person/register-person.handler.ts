import { Clock, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Person } from '../../../domain/aggregates/person.aggregate.js';
import { PersonRepository } from '../../../domain/repositories/person.repository.js';
import { DisplayName } from '../../../domain/value-objects/display-name.vo.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { RegisterPersonCommand } from './register-person.command.js';

@CommandHandler(RegisterPersonCommand, [PersonRepository, Clock])
export class RegisterPersonHandler implements CommandHandler<RegisterPersonCommand> {
  constructor(
    private readonly personRepository: PersonRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: RegisterPersonCommand): Promise<string> {
    const contact = {
      displayName: unwrap(DisplayName.create(command.displayName)),
      email: unwrap(Email.create(command.email)),
    };

    const known = await this.personRepository.findById(command.actor.id);
    const target = known ?? Person.create(command.actor.id, contact, this.clock.now());

    known?.registerAgain(contact);

    await this.personRepository.save(target);

    return target.id;
  }
}

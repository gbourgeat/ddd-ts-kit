import { Clock, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Person } from '@/contexts/identity/domain/aggregates/person.aggregate';
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
import { DisplayName } from '@/contexts/identity/domain/value-objects/display-name.vo';
import { Email } from '@/contexts/identity/domain/value-objects/email.vo';
import { RegisterPersonCommand } from '@/contexts/identity/application/commands/register-person/register-person.command';

@CommandHandler(RegisterPersonCommand)
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

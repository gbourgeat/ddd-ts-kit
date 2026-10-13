import { type Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Person } from '@/contexts/identity/domain/aggregates/person.aggregate';
import type { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
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
      displayName: DisplayName.create(command.displayName),
      email: Email.create(command.email),
    };

    const known = await this.personRepository.findById(command.actor.id);
    const person = known ?? Person.create(command.actor.id, contact, this.clock.now());

    known?.registerAgain(contact);

    await this.personRepository.save(person);

    return person.id;
  }
}

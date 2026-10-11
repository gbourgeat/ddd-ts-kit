import { Clock, IdGenerator, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Practice } from '@/contexts/identity/domain/aggregates/practice.aggregate';
import { PersonNotRegisteredError } from '@/contexts/identity/domain/errors/person-not-registered.error';
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
import { PracticeRepository } from '@/contexts/identity/domain/repositories/practice.repository';
import { TimeZone } from '@/contexts/identity/domain/value-objects/time-zone.vo';
import { OpenPracticeCommand } from '@/contexts/identity/application/commands/open-practice/open-practice.command';

@CommandHandler(OpenPracticeCommand, [PracticeRepository, PersonRepository, IdGenerator, Clock])
export class OpenPracticeHandler implements CommandHandler<OpenPracticeCommand> {
  constructor(
    private readonly practiceRepository: PracticeRepository,
    private readonly personRepository: PersonRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: OpenPracticeCommand): Promise<string> {
    const { name, managerId } = command.opening;
    const timeZone = unwrap(TimeZone.create(command.opening.timeZone));
    const manager = await this.personRepository.findById(managerId);

    if (manager === undefined) {
      throw new PersonNotRegisteredError(managerId);
    }

    const opening = { name, timeZone, manager: { personId: manager.id, displayName: manager.displayName } };
    const target = Practice.create(this.ids.next(), opening, this.clock.now());

    await this.practiceRepository.save(target);

    return target.id;
  }
}

import { Clock, IdGenerator, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Practice } from '../../../domain/aggregates/practice.aggregate.js';
import { PersonNotRegisteredError } from '../../../domain/errors/person-not-registered.error.js';
import { PersonRepository } from '../../../domain/repositories/person.repository.js';
import { PracticeRepository } from '../../../domain/repositories/practice.repository.js';
import { TimeZone } from '../../../domain/value-objects/time-zone.vo.js';
import { OpenPracticeCommand } from './open-practice.command.js';

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

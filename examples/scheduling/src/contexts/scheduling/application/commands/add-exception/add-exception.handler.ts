import { Clock, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownCalendarError } from '../../../domain/errors/unknown-calendar.error.js';
import { CalendarRepository } from '../../../domain/repositories/calendar.repository.js';
import { Exception } from '../../../domain/value-objects/exception.vo.js';
import { Range } from '../../../domain/value-objects/range.vo.js';
import { AddExceptionCommand } from './add-exception.command.js';

@CommandHandler(AddExceptionCommand, [CalendarRepository, Clock])
export class AddExceptionHandler implements CommandHandler<AddExceptionCommand> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: AddExceptionCommand): Promise<string> {
    const target = await this.calendarRepository.findById(command.calendarId);

    if (target === undefined) throw new UnknownCalendarError(command.calendarId);

    const ranges = command.ranges.map(({ start, end }) => unwrap(Range.create(start, end)));

    target.addException(unwrap(Exception.create(command.day, ranges)), this.clock.now());

    await this.calendarRepository.save(target);

    return target.id;
  }
}

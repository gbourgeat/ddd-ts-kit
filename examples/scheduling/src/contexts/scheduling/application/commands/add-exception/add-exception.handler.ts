import { type Clock, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';
import type { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { Exception } from '@/contexts/scheduling/domain/value-objects/exception.vo';
import { Range } from '@/contexts/scheduling/domain/value-objects/range.vo';
import { AddExceptionCommand } from '@/contexts/scheduling/application/commands/add-exception/add-exception.command';

@CommandHandler(AddExceptionCommand)
export class AddExceptionHandler implements CommandHandler<AddExceptionCommand> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: AddExceptionCommand): Promise<string> {
    const target = await this.calendarRepository.findById(command.calendarId);

    if (target === undefined) {
      throw CalendarError.unknown(command.calendarId);
    }

    const ranges = command.ranges.map(({ start, end }) => unwrap(Range.create(start, end)));

    target.addException(unwrap(Exception.create(command.day, ranges)), this.clock.now());

    await this.calendarRepository.save(target);

    return target.id;
  }
}

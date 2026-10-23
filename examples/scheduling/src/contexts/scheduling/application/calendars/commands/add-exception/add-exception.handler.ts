import { type Clock } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { UnknownCalendar } from '@/contexts/scheduling/domain/calendars/errors/unknown-calendar.error';
import type { CalendarRepository } from '@/contexts/scheduling/domain/calendars/repositories/calendar.repository';
import { Exception } from '@/contexts/scheduling/domain/calendars/value-objects/exception.vo';
import { Range } from '@/contexts/scheduling/domain/calendars/value-objects/range.vo';
import { AddExceptionCommand } from '@/contexts/scheduling/application/calendars/commands/add-exception/add-exception.command';

@CommandHandler(AddExceptionCommand)
export class AddExceptionHandler implements CommandHandler<AddExceptionCommand> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: AddExceptionCommand): Promise<string> {
    const calendar = await this.calendarRepository.findById(command.calendarId);

    if (calendar === undefined) {
      throw UnknownCalendar.forCalendar(command.calendarId);
    }

    const ranges = command.ranges.map(({ start, end }) => Range.create(start, end));

    calendar.addException(Exception.create(command.day, ranges), this.clock.now());

    await this.calendarRepository.save(calendar);

    return calendar.id;
  }
}

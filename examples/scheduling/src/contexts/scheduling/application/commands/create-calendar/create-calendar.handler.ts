import { Clock, IdGenerator, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Calendar } from '@/contexts/scheduling/domain/aggregates/calendar.aggregate.js';
import { UnknownPractitionerError } from '@/contexts/scheduling/domain/errors/unknown-practitioner.error.js';
import { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository.js';
import { TimeZone } from '@/contexts/scheduling/domain/value-objects/time-zone.vo.js';
import { PractitionerDirectory } from '@/contexts/scheduling/application/ports/practitioner-directory.port.js';
import { CreateCalendarCommand } from '@/contexts/scheduling/application/commands/create-calendar/create-calendar.command.js';

@CommandHandler(CreateCalendarCommand, [CalendarRepository, PractitionerDirectory, IdGenerator, Clock])
export class CreateCalendarHandler implements CommandHandler<CreateCalendarCommand> {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly practitioners: PractitionerDirectory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute({ practiceId, practitionerId }: CreateCalendarCommand): Promise<string> {
    const practitioner = await this.practitioners.get(`${practiceId}.${practitionerId}`);

    if (practitioner === undefined) {
      throw new UnknownPractitionerError(practiceId, practitionerId);
    }

    // The calendar lives by the wall clock of its practice.
    const timeZone = unwrap(TimeZone.create(practitioner.timeZone));
    const target = Calendar.create(this.ids.next(), { practiceId, practitionerId, timeZone }, this.clock.now());

    await this.calendarRepository.save(target);

    return target.id;
  }
}

import { type Clock, type IdGenerator, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Calendar } from '@/contexts/scheduling/domain/aggregates/calendar.aggregate';
import { CalendarError } from '@/contexts/scheduling/domain/errors/calendar.error';
import type { CalendarRepository } from '@/contexts/scheduling/domain/repositories/calendar.repository';
import { TimeZone } from '@/contexts/scheduling/domain/value-objects/time-zone.vo';
import type { PractitionerDirectory } from '@/contexts/scheduling/application/ports/practitioner-directory.port';
import { CreateCalendarCommand } from '@/contexts/scheduling/application/commands/create-calendar/create-calendar.command';

@CommandHandler(CreateCalendarCommand)
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
      throw CalendarError.unknownPractitioner(practiceId, practitionerId);
    }

    // The calendar lives by the wall clock of its practice.
    const timeZone = unwrap(TimeZone.create(practitioner.timeZone));
    const target = Calendar.create(this.ids.next(), { practiceId, practitionerId, timeZone }, this.clock.now());

    await this.calendarRepository.save(target);

    return target.id;
  }
}

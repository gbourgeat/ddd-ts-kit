import { type Clock, type IdGenerator } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Calendar } from '@/contexts/scheduling/domain/calendars/aggregates/calendar.aggregate';
import { UnknownPractitioner } from '@/contexts/scheduling/domain/calendars/errors/unknown-practitioner.error';
import type { CalendarRepository } from '@/contexts/scheduling/domain/calendars/repositories/calendar.repository';
import { TimeZone } from '@/contexts/scheduling/domain/calendars/value-objects/time-zone.vo';
import type { PractitionerDirectory } from '@/contexts/scheduling/application/calendars/ports/practitioner-directory.port';
import { CreateCalendarCommand } from '@/contexts/scheduling/application/calendars/commands/create-calendar/create-calendar.command';

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
      throw UnknownPractitioner.atPractice(practiceId, practitionerId);
    }

    // The calendar lives by the wall clock of its practice.
    const timeZone = TimeZone.create(practitioner.timeZone);
    const calendar = Calendar.create(this.ids.next(), { practiceId, practitionerId, timeZone }, this.clock.now());

    await this.calendarRepository.save(calendar);

    return calendar.id;
  }
}

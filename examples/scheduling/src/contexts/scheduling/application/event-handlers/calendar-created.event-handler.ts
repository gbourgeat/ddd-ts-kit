import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { CalendarCreated } from '@/contexts/scheduling/domain/events/calendar-created.event';
import { SchedulingRelationships } from '@/contexts/scheduling/application/ports/scheduling-relationships.port';

/** When a calendar is created, the platform learns whose desk and which practice it belongs to: rights on it follow. */
@DomainEventHandler(CalendarCreated, { name: 'scheduling.calendar.created' }, [SchedulingRelationships])
export class CalendarCreatedEventHandler implements DomainEventHandler<CalendarCreated> {
  constructor(private readonly relationships: SchedulingRelationships) {}

  async handle(event: CalendarCreated): Promise<void> {
    await this.relationships.recordCalendar({
      calendarId: event.aggregateId,
      practiceId: event.practiceId,
      practitionerId: event.practitionerId,
    });
  }
}

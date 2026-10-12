import type { IdGenerator, IntegrationEventPublisher } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { CalendarCreated } from '@/contexts/scheduling/domain/events/calendar-created.event';
import { calendarCreatedV1 } from '@/contexts/scheduling/published-language/calendar-created.v1.integration-event';

@DomainEventHandler(CalendarCreated, { name: 'scheduling.calendar.created' })
export class CalendarCreatedPublisher implements DomainEventHandler<CalendarCreated> {
  constructor(
    private readonly publisher: IntegrationEventPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async handle(event: CalendarCreated): Promise<void> {
    const published = calendarCreatedV1.create(
      {
        calendarId: event.aggregateId,
        practiceId: event.practiceId,
        practitionerId: event.practitionerId,
        timeZone: event.timeZone,
      },
      { id: this.ids.next(), occurredAt: event.occurredAt },
    );

    await this.publisher.publish([published]);
  }
}

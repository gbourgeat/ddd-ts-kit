import { cacheTag, type CacheInvalidation } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { CalendarAppointmentTypeDefined } from '@/contexts/scheduling/calendars/domain/events/calendar-appointment-type-defined.event';

/**
 * When an appointment type is defined on a calendar, its version changes: the answers filed under the calendar name the version
 * a write is made on (If-Match), so they are purged from the shared caches after the commit.
 */
@DomainEventHandler(CalendarAppointmentTypeDefined)
export class CalendarAppointmentTypeDefinedEventHandler implements DomainEventHandler<CalendarAppointmentTypeDefined> {
  constructor(private readonly cacheInvalidation: CacheInvalidation) {}

  async handle(event: CalendarAppointmentTypeDefined): Promise<void> {
    await this.cacheInvalidation.invalidate([cacheTag('calendar', event.aggregateId)]);
  }
}

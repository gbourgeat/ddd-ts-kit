import { cacheTag, type CacheInvalidation } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { CalendarExceptionAdded } from '@/contexts/scheduling/domain/calendars/events/calendar-exception-added.event';

/**
 * When an exception is added to a calendar, its version changes: the answers filed under the calendar name the version
 * a write is made on (If-Match), so they are purged from the shared caches after the commit.
 */
@DomainEventHandler(CalendarExceptionAdded)
export class CalendarExceptionAddedEventHandler implements DomainEventHandler<CalendarExceptionAdded> {
  constructor(private readonly cacheInvalidation: CacheInvalidation) {}

  async handle(event: CalendarExceptionAdded): Promise<void> {
    await this.cacheInvalidation.invalidate([cacheTag('calendar', event.aggregateId)]);
  }
}

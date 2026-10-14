import { cacheTag, type CacheInvalidation } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { CalendarTimeOffAdded } from '@/contexts/scheduling/domain/events/calendar-time-off-added.event';

/**
 * When time off is added to a calendar, its version changes: the answers filed under the calendar name the version
 * a write is made on (If-Match), so they are purged from the shared caches after the commit.
 */
@DomainEventHandler(CalendarTimeOffAdded)
export class CalendarTimeOffAddedEventHandler implements DomainEventHandler<CalendarTimeOffAdded> {
  constructor(private readonly cacheInvalidation: CacheInvalidation) {}

  async handle(event: CalendarTimeOffAdded): Promise<void> {
    await this.cacheInvalidation.invalidate([cacheTag('calendar', event.aggregateId)]);
  }
}

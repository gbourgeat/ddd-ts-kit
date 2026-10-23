import { cacheTag, type CacheInvalidation } from '@ddd-ts-kit/kernel';
import { DomainEventHandler } from '@ddd-ts-kit/kernel/declarations';
import { CalendarOpeningHoursSet } from '@/contexts/scheduling/calendars/domain/events/calendar-opening-hours-set.event';

/**
 * When the hours of a calendar change, the answers that show them are purged from the shared
 * caches. Asked before the commit, done after it: the request is written with the change, so a
 * refused change purges nothing and a committed one is purged even if the process stops.
 */
@DomainEventHandler(CalendarOpeningHoursSet)
export class CalendarOpeningHoursSetEventHandler implements DomainEventHandler<CalendarOpeningHoursSet> {
  constructor(private readonly cacheInvalidation: CacheInvalidation) {}

  async handle(event: CalendarOpeningHoursSet): Promise<void> {
    await this.cacheInvalidation.invalidate([cacheTag('calendar', event.aggregateId)]);
  }
}

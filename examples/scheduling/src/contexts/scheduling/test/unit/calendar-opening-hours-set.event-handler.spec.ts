import { describe, expect, it } from 'vitest';
import {
  InMemoryCacheInvalidation,
  InMemoryDomainEventDispatcher,
  InMemoryUnitOfWork,
  announceDomainEvents,
  unitOfWorkStage,
} from '@ddd-ts-kit/kernel';
import { CalendarOpeningHoursSetEventHandler } from '@/contexts/scheduling/application/event-handlers/calendar-opening-hours-set.event-handler';
import { CalendarOpeningHoursSet } from '@/contexts/scheduling/domain/events/calendar-opening-hours-set.event';

describe('When the opening hours of a calendar are set', () => {
  it('asks, before the commit, for the answers filed under the calendar to be purged after it', async () => {
    const cacheInvalidation = new InMemoryCacheInvalidation();
    const handler = new CalendarOpeningHoursSetEventHandler(cacheInvalidation);
    const event = new CalendarOpeningHoursSet('calendar-1', new Date('2026-01-01T00:00:00.000Z'));
    const domainEvents = new InMemoryDomainEventDispatcher();
    const reactedAt: string[] = [];

    domainEvents.on(
      CalendarOpeningHoursSet.eventName,
      async () => {
        await handler.handle(event);
        reactedAt.push(unitOfWorkStage());
      },
      { phase: 'before-commit' },
    );

    await new InMemoryUnitOfWork().run(() => announceDomainEvents([event], domainEvents));

    expect(reactedAt).toEqual(['before-commit']);
    expect(cacheInvalidation.invalidated).toEqual(['calendar:calendar-1']);
  });
});

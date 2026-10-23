import { describe, expect, it } from 'vitest';
import {
  InMemoryCacheInvalidation,
  InMemoryDomainEventDispatcher,
  InMemoryUnitOfWork,
  announceDomainEvents,
  unitOfWorkStage,
} from '@ddd-ts-kit/kernel';
import { CalendarTimeOffAddedEventHandler } from '@/contexts/scheduling/application/calendars/event-handlers/calendar-time-off-added.event-handler';
import { CalendarTimeOffAdded } from '@/contexts/scheduling/domain/calendars/events/calendar-time-off-added.event';

describe('When time off is added to a calendar', () => {
  it('asks, before the commit, for the answers filed under the calendar to be purged after it', async () => {
    const cacheInvalidation = new InMemoryCacheInvalidation();
    const handler = new CalendarTimeOffAddedEventHandler(cacheInvalidation);

    const event = new CalendarTimeOffAdded(
      'calendar-1',
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-03-02T09:00:00.000Z'),
      new Date('2026-03-02T12:00:00.000Z'),
    );

    const domainEvents = new InMemoryDomainEventDispatcher();
    const reactedAt: string[] = [];

    const asSubscribed = async (): Promise<void> => {
      await handler.handle(event);
      reactedAt.push(unitOfWorkStage());
    };

    domainEvents.on(CalendarTimeOffAdded.eventName, asSubscribed, { phase: 'before-commit' });
    await new InMemoryUnitOfWork().run(() => announceDomainEvents([event], domainEvents));

    expect(reactedAt).toEqual(['before-commit']);
    expect(cacheInvalidation.invalidated).toEqual(['calendar:calendar-1']);
  });
});

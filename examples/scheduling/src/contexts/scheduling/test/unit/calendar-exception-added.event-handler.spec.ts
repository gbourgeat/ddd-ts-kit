import { describe, expect, it } from 'vitest';
import {
  InMemoryCacheInvalidation,
  InMemoryDomainEventDispatcher,
  InMemoryUnitOfWork,
  announceDomainEvents,
  unitOfWorkStage,
} from '@ddd-ts-kit/kernel';
import { CalendarExceptionAddedEventHandler } from '@/contexts/scheduling/application/event-handlers/calendar-exception-added.event-handler';
import { CalendarExceptionAdded } from '@/contexts/scheduling/domain/events/calendar-exception-added.event';

describe('When an exception is added to a calendar', () => {
  it('asks, before the commit, for the answers filed under the calendar to be purged after it', async () => {
    const cacheInvalidation = new InMemoryCacheInvalidation();
    const handler = new CalendarExceptionAddedEventHandler(cacheInvalidation);
    const event = new CalendarExceptionAdded('calendar-1', new Date('2026-01-01T00:00:00.000Z'), '2026-03-02');
    const domainEvents = new InMemoryDomainEventDispatcher();
    const reactedAt: string[] = [];

    const asSubscribed = async (): Promise<void> => {
      await handler.handle(event);
      reactedAt.push(unitOfWorkStage());
    };

    domainEvents.on(CalendarExceptionAdded.eventName, asSubscribed, { phase: 'before-commit' });
    await new InMemoryUnitOfWork().run(() => announceDomainEvents([event], domainEvents));

    expect(reactedAt).toEqual(['before-commit']);
    expect(cacheInvalidation.invalidated).toEqual(['calendar:calendar-1']);
  });
});

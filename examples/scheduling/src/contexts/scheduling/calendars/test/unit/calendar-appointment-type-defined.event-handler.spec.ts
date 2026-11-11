import { describe, expect, it } from 'vitest';
import {
  InMemoryCacheInvalidation,
  InMemoryDomainEventDispatcher,
  InMemoryUnitOfWork,
  announceDomainEvents,
  unitOfWorkStage,
} from '@ddd-ts-kit/kernel';
import { CalendarAppointmentTypeDefinedEventHandler } from '@/contexts/scheduling/calendars/application/event-handlers/calendar-appointment-type-defined.event-handler';
import { CalendarAppointmentTypeDefined } from '@/contexts/scheduling/calendars/domain/events/calendar-appointment-type-defined.event';

describe('When an appointment type is defined on a calendar', () => {
  it('asks, before the commit, for the answers filed under the calendar to be purged after it', async () => {
    const cacheInvalidation = new InMemoryCacheInvalidation();
    const handler = new CalendarAppointmentTypeDefinedEventHandler(cacheInvalidation);
    const event = new CalendarAppointmentTypeDefined('calendar-1', new Date('2026-01-01T00:00:00.000Z'), 'checkup');
    const domainEvents = new InMemoryDomainEventDispatcher();
    const reactedAt: string[] = [];

    const asSubscribed = async (): Promise<void> => {
      await handler.handle(event);
      reactedAt.push(unitOfWorkStage());
    };

    domainEvents.on(CalendarAppointmentTypeDefined.eventName, asSubscribed, { phase: 'before-commit' });
    await new InMemoryUnitOfWork().run(() => announceDomainEvents([event], domainEvents));

    expect(reactedAt).toEqual(['before-commit']);
    expect(cacheInvalidation.invalidated).toEqual(['calendar:calendar-1']);
  });
});

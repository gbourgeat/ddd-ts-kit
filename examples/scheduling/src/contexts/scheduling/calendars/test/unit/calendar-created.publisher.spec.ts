import { describe, expect, it } from 'vitest';
import { InMemoryEventBus, SequentialIdGenerator } from '@ddd-ts-kit/kernel';
import { CalendarCreatedPublisher } from '@/contexts/scheduling/calendars/application/integration/publishers/calendar-created.publisher';
import { CalendarCreated } from '@/contexts/scheduling/calendars/domain/events/calendar-created.event';

describe('Publishing "calendar created" to other contexts', () => {
  it('publishes version 1 of scheduling.calendar.created with every field of its public payload', async () => {
    const bus = new InMemoryEventBus();
    const publisher = new CalendarCreatedPublisher(bus, new SequentialIdGenerator('event'));

    await publisher.handle(
      new CalendarCreated(
        'calendar-1',
        new Date('2026-01-01T00:00:00.000Z'),
        'practice-1',
        'practitioner-1',
        'Europe/Paris',
      ),
    );

    expect(bus.published).toEqual([
      {
        id: 'event-1',
        type: 'scheduling.calendar.created',
        version: 1,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: {
          calendarId: 'calendar-1',
          practiceId: 'practice-1',
          practitionerId: 'practitioner-1',
          timeZone: 'Europe/Paris',
        },
      },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { CalendarCreated } from '@/contexts/scheduling/domain/events/calendar-created.event';

describe('CalendarCreated', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new CalendarCreated(
      'calendar-1',
      new Date('2026-01-01T00:00:00.000Z'),
      'practice-1',
      'practitioner-1',
      'Europe/Paris',
    );

    expect(event.name).toBe('scheduling.calendar.created');
    expect(event.aggregateId).toBe('calendar-1');
  });
});

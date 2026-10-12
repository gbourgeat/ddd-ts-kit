import { describe, expect, it } from 'vitest';
import { CalendarExceptionAdded } from '@/contexts/scheduling/domain/events/calendar-exception-added.event';

describe('CalendarExceptionAdded', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new CalendarExceptionAdded('calendar-1', new Date('2026-01-01T00:00:00.000Z'), '2026-05-01');

    expect(event.name).toBe('scheduling.calendar.exception-added');
    expect(event.aggregateId).toBe('calendar-1');
  });
});

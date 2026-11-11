import { describe, expect, it } from 'vitest';
import { CalendarOpeningHoursSet } from '@/contexts/scheduling/calendars/domain/events/calendar-opening-hours-set.event';

describe('CalendarOpeningHoursSet', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new CalendarOpeningHoursSet('calendar-1', new Date('2026-01-01T00:00:00.000Z'));

    expect(event.name).toBe('scheduling.calendar.opening-hours-set');
    expect(event.aggregateId).toBe('calendar-1');
  });
});

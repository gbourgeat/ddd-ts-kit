import { describe, expect, it } from 'vitest';
import { CalendarTimeOffAdded } from '../../domain/events/calendar-time-off-added.event.js';

describe('CalendarTimeOffAdded', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new CalendarTimeOffAdded('calendar-1', new Date('2026-01-01T00:00:00.000Z'), new Date('2026-08-01T00:00:00.000Z'), new Date('2026-08-15T00:00:00.000Z'));

    expect(event.name).toBe('scheduling.calendar.time-off-added');
    expect(event.aggregateId).toBe('calendar-1');
  });
});

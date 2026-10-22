import { describe, expect, it } from 'vitest';
import { CalendarAppointmentTypeDefined } from '@/contexts/scheduling/domain/calendars/events/calendar-appointment-type-defined.event';

describe('CalendarAppointmentTypeDefined', () => {
  it('is named after the context, the aggregate and the fact', () => {
    const event = new CalendarAppointmentTypeDefined('calendar-1', new Date('2026-01-01T00:00:00.000Z'), 'type-1');

    expect(event.name).toBe('scheduling.calendar.appointment-type-defined');
    expect(event.aggregateId).toBe('calendar-1');
  });
});

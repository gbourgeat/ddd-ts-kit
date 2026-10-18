import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownCalendar } from '@/contexts/scheduling/domain/errors/unknown-calendar.error';

describe('UnknownCalendar', () => {
  it('refuses with the code UNKNOWN_CALENDAR, its message and its facts', () => {
    const error = UnknownCalendar.forCalendar('calendar-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNKNOWN_CALENDAR');
    expect(error.message).toBe('There is no calendar calendar-1.');
    expect(error.facts).toEqual({ calendarId: 'calendar-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

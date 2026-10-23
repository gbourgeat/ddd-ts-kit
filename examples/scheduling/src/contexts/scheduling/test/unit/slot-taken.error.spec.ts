import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { SlotTaken } from '@/contexts/scheduling/domain/calendars/errors/slot-taken.error';

const startsAt = new Date('2026-03-02T09:00:00.000Z');

describe('SlotTaken', () => {
  it('refuses with the code SLOT_TAKEN, its message and its facts', () => {
    const error = SlotTaken.forCalendar('calendar-1', startsAt);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('SLOT_TAKEN');
    expect(error.message).toBe('The slot starting at 2026-03-02T09:00:00.000Z on calendar calendar-1 is already held.');
    expect(error.facts).toEqual({ calendarId: 'calendar-1', startsAt });
    expect(error.exposedFacts).toEqual({ startsAt });
  });
});

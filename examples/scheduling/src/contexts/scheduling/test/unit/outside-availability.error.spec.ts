import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { OutsideAvailability } from '@/contexts/scheduling/domain/calendars/errors/outside-availability.error';

const startsAt = new Date('2026-03-02T09:00:00.000Z');

describe('OutsideAvailability', () => {
  it('refuses with the code OUTSIDE_AVAILABILITY, its message and its facts', () => {
    const error = OutsideAvailability.atStart(startsAt);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('OUTSIDE_AVAILABILITY');
    expect(error.message).toBe('The calendar takes no appointment at 2026-03-02T09:00:00.000Z.');
    expect(error.facts).toEqual({ startsAt });
    expect(error.exposedFacts).toEqual({ startsAt });
  });
});

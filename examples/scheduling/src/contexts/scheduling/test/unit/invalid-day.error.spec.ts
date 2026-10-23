import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidDay } from '@/contexts/scheduling/domain/calendars/errors/invalid-day.error';

describe('InvalidDay', () => {
  it('refuses with the code INVALID_DAY, its message and its facts', () => {
    const error = InvalidDay.forDay('2026-13-40');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_DAY');
    expect(error.message).toBe('2026-13-40 is not a day written YYYY-MM-DD.');
    expect(error.facts).toEqual({ day: '2026-13-40' });
    expect(error.exposedFacts).toEqual({ day: '2026-13-40' });
  });
});

import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidTimeOff } from '@/contexts/scheduling/domain/errors/invalid-time-off.error';

describe('InvalidTimeOff', () => {
  it('refuses with the code INVALID_TIME_OFF, its message and its facts', () => {
    const error = InvalidTimeOff.forRule('ends after it starts');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_TIME_OFF');
    expect(error.message).toBe('A time off ends after it starts.');
    expect(error.facts).toEqual({ rule: 'ends after it starts' });
    expect(error.exposedFacts).toEqual({});
  });
});

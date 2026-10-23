import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidRange } from '@/contexts/scheduling/domain/calendars/errors/invalid-range.error';

describe('InvalidRange', () => {
  it('refuses with the code INVALID_RANGE, its message and its facts', () => {
    const error = InvalidRange.forRule('ends after it starts');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_RANGE');
    expect(error.message).toBe('A range ends after it starts.');
    expect(error.facts).toEqual({ rule: 'ends after it starts' });
    expect(error.exposedFacts).toEqual({});
  });
});

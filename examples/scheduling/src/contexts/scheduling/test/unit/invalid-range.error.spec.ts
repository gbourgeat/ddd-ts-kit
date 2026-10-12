import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidRangeError } from '@/contexts/scheduling/domain/errors/invalid-range.error';

describe('InvalidRangeError', () => {
  it('carries its stable code', () => {
    const error = new InvalidRangeError('ends after it starts');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_RANGE');
  });
});

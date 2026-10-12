import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidTimeOffError } from '@/contexts/scheduling/domain/errors/invalid-time-off.error';

describe('InvalidTimeOffError', () => {
  it('carries its stable code', () => {
    const error = new InvalidTimeOffError('ends after it starts');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_TIME_OFF');
  });
});

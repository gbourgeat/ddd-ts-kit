import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidDayError } from '#src/contexts/scheduling/domain/errors/invalid-day.error.js';

describe('InvalidDayError', () => {
  it('carries its stable code', () => {
    const error = new InvalidDayError('2026-02-30');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_DAY');
  });
});

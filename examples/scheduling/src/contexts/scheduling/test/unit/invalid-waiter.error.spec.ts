import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidWaiter } from '@/contexts/scheduling/domain/errors/invalid-waiter.error';

describe('InvalidWaiter', () => {
  it('refuses with the code INVALID_WAITER, its message and its facts', () => {
    const error = InvalidWaiter.forRule('names a patient');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_WAITER');
    expect(error.message).toBe('A waiter names a patient.');
    expect(error.facts).toEqual({ rule: 'names a patient' });
    expect(error.exposedFacts).toEqual({});
  });
});

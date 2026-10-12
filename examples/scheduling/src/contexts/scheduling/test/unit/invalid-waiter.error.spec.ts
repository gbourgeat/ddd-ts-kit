import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidWaiterError } from '@/contexts/scheduling/domain/errors/invalid-waiter.error';

describe('InvalidWaiterError', () => {
  it('carries its stable code', () => {
    const error = new InvalidWaiterError('names a patient');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_WAITER');
  });
});

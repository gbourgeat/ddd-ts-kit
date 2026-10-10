import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidWaiterError } from '#src/contexts/scheduling/domain/errors/invalid-waiter.error.js';

describe('InvalidWaiterError', () => {
  it('carries its stable code', () => {
    const error = new InvalidWaiterError('names a patient');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_WAITER');
  });
});

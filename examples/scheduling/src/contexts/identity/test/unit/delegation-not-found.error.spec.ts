import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { DelegationNotFoundError } from '@/contexts/identity/domain/errors/delegation-not-found.error.js';

describe('DelegationNotFoundError', () => {
  it('carries its stable code', () => {
    const error = new DelegationNotFoundError('delegation-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('DELEGATION_NOT_FOUND');
  });
});

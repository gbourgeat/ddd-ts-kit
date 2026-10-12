import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { DelegationNotActiveError } from '@/contexts/identity/domain/errors/delegation-not-active.error';

describe('DelegationNotActiveError', () => {
  it('carries its stable code', () => {
    const error = new DelegationNotActiveError('delegation-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('DELEGATION_NOT_ACTIVE');
  });
});

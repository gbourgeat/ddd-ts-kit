import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { DelegationAlreadyActiveError } from '@/contexts/identity/domain/errors/delegation-already-active.error';

describe('DelegationAlreadyActiveError', () => {
  it('carries its stable code', () => {
    const error = new DelegationAlreadyActiveError('delegation-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('DELEGATION_ALREADY_ACTIVE');
  });
});

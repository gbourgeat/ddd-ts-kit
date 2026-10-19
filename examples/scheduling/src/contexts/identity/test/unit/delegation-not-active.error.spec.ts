import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { DelegationNotActive } from '@/contexts/identity/domain/errors/delegation-not-active.error';

describe('DelegationNotActive', () => {
  it('refuses with the code DELEGATION_NOT_ACTIVE, its message and its facts', () => {
    const error = DelegationNotActive.forDelegation('delegation-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('DELEGATION_NOT_ACTIVE');
    expect(error.message).toBe('The delegation delegation-1 already ended.');
    expect(error.facts).toEqual({ delegationId: 'delegation-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

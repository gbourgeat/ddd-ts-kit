import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { DelegationAlreadyActive } from '@/contexts/identity/domain/errors/delegation-already-active.error';

describe('DelegationAlreadyActive', () => {
  it('refuses with the code DELEGATION_ALREADY_ACTIVE, its message and its facts', () => {
    const error = DelegationAlreadyActive.forDelegation('delegation-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('DELEGATION_ALREADY_ACTIVE');
    expect(error.message).toBe('This practitioner already delegates to this assistant (delegation delegation-1).');
    expect(error.facts).toEqual({ delegationId: 'delegation-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

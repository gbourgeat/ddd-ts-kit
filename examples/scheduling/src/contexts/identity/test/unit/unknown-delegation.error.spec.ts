import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownDelegation } from '@/contexts/identity/domain/errors/unknown-delegation.error';

describe('UnknownDelegation', () => {
  it('refuses with the code DELEGATION_NOT_FOUND, its message and its facts', () => {
    const error = UnknownDelegation.forDelegation('delegation-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('DELEGATION_NOT_FOUND');
    expect(error.message).toBe('The delegation delegation-1 does not exist on this desk.');
    expect(error.facts).toEqual({ delegationId: 'delegation-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

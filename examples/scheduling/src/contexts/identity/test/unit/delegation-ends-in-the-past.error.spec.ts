import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { DelegationEndsInThePastError } from '@/contexts/identity/domain/errors/delegation-ends-in-the-past.error';

describe('DelegationEndsInThePastError', () => {
  it('carries its stable code', () => {
    const error = new DelegationEndsInThePastError(new Date('2026-01-01T00:00:00.000Z'));

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('DELEGATION_ENDS_IN_THE_PAST');
  });
});

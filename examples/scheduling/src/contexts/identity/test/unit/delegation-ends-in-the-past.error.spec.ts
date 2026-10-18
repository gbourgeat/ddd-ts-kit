import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { DelegationEndsInThePast } from '@/contexts/identity/domain/errors/delegation-ends-in-the-past.error';

const endsAt = new Date('2026-03-02T09:00:00.000Z');

describe('DelegationEndsInThePast', () => {
  it('refuses with the code DELEGATION_ENDS_IN_THE_PAST, its message and its facts', () => {
    const error = DelegationEndsInThePast.atEnd(endsAt);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('DELEGATION_ENDS_IN_THE_PAST');
    expect(error.message).toBe('A delegation cannot end in the past (2026-03-02T09:00:00.000Z).');
    expect(error.facts).toEqual({ endsAt });
    expect(error.exposedFacts).toEqual({ endsAt });
  });
});

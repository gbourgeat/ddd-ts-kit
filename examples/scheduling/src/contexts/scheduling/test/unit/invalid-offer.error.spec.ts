import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidOffer } from '@/contexts/scheduling/domain/waitlist/errors/invalid-offer.error';

describe('InvalidOffer', () => {
  it('refuses with the code INVALID_OFFER, its message and its facts', () => {
    const error = InvalidOffer.forRule('expires before its slot starts');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_OFFER');
    expect(error.message).toBe('An offer expires before its slot starts.');
    expect(error.facts).toEqual({ rule: 'expires before its slot starts' });
    expect(error.exposedFacts).toEqual({});
  });
});

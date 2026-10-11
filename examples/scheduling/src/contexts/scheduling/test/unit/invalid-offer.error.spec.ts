import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidOfferError } from '@/contexts/scheduling/domain/errors/invalid-offer.error';

describe('InvalidOfferError', () => {
  it('carries its stable code', () => {
    const error = new InvalidOfferError('expires before its slot starts');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_OFFER');
  });
});

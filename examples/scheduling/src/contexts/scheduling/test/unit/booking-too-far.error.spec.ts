import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { BookingTooFarError } from '@/contexts/scheduling/domain/errors/booking-too-far.error';

describe('BookingTooFarError', () => {
  it('carries its stable code', () => {
    const error = new BookingTooFarError(129600);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('BOOKING_TOO_FAR');
  });
});

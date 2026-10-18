import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { BookingTooFar } from '@/contexts/scheduling/domain/errors/booking-too-far.error';

describe('BookingTooFar', () => {
  it('refuses with the code BOOKING_TOO_FAR, its message and its facts', () => {
    const error = BookingTooFar.withHorizon(129600);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('BOOKING_TOO_FAR');
    expect(error.message).toBe('A slot is booked at most 129600 minutes before it starts.');
    expect(error.facts).toEqual({ horizon: 129600 });
    expect(error.exposedFacts).toEqual({ horizon: 129600 });
  });
});

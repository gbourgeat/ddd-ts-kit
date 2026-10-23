import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { BookingTooLate } from '@/contexts/scheduling/domain/calendars/errors/booking-too-late.error';

describe('BookingTooLate', () => {
  it('refuses with the code BOOKING_TOO_LATE, its message and its facts', () => {
    const error = BookingTooLate.withNotice(120);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('BOOKING_TOO_LATE');
    expect(error.message).toBe('A slot is booked at least 120 minutes before it starts.');
    expect(error.facts).toEqual({ notice: 120 });
    expect(error.exposedFacts).toEqual({ notice: 120 });
  });
});

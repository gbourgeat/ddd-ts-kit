import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { BookingTooLateError } from '#src/contexts/scheduling/domain/errors/booking-too-late.error.js';

describe('BookingTooLateError', () => {
  it('carries its stable code', () => {
    const error = new BookingTooLateError(120);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('BOOKING_TOO_LATE');
  });
});

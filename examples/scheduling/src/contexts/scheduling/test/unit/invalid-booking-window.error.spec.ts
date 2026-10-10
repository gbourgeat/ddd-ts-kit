import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidBookingWindowError } from '#src/contexts/scheduling/domain/errors/invalid-booking-window.error.js';

describe('InvalidBookingWindowError', () => {
  it('carries its stable code', () => {
    const error = new InvalidBookingWindowError('has a horizon after its notice');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_BOOKING_WINDOW');
  });
});

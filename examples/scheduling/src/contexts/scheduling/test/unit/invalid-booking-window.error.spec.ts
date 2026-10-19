import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidBookingWindow } from '@/contexts/scheduling/domain/errors/invalid-booking-window.error';

describe('InvalidBookingWindow', () => {
  it('refuses with the code INVALID_BOOKING_WINDOW, its message and its facts', () => {
    const error = InvalidBookingWindow.forRule('has a horizon after its notice');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_BOOKING_WINDOW');
    expect(error.message).toBe('A booking window has a horizon after its notice.');
    expect(error.facts).toEqual({ rule: 'has a horizon after its notice' });
    expect(error.exposedFacts).toEqual({});
  });
});

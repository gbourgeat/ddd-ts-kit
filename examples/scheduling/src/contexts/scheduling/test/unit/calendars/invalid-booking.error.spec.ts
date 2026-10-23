import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidBooking } from '@/contexts/scheduling/calendars/domain/errors/invalid-booking.error';

describe('InvalidBooking', () => {
  it('refuses with the code INVALID_BOOKING, its message and its facts', () => {
    const error = InvalidBooking.forRule('names no patient');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_BOOKING');
    expect(error.message).toBe('A booking names no patient.');
    expect(error.facts).toEqual({ reason: 'names no patient' });
    expect(error.exposedFacts).toEqual({});
  });
});

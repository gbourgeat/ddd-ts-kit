import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidBookingError } from '../../domain/errors/invalid-booking.error.js';

describe('InvalidBookingError', () => {
  it('carries its stable code', () => {
    const error = new InvalidBookingError('names its patient');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_BOOKING');
    expect(error.message).toBe('A booking names its patient.');
  });
});

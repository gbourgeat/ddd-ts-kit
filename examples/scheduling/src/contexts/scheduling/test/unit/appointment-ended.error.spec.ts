import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AppointmentEndedError } from '../../domain/errors/appointment-ended.error.js';

describe('AppointmentEndedError', () => {
  it('carries its stable code', () => {
    const error = new AppointmentEndedError('appointment-1', 'cancelled');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('APPOINTMENT_ENDED');
    expect(error.message).toBe('Appointment appointment-1 is cancelled and does not change any more.');
  });
});

import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AppointmentAlreadyConfirmedError } from '#src/contexts/scheduling/domain/errors/appointment-already-confirmed.error.js';

describe('AppointmentAlreadyConfirmedError', () => {
  it('carries its stable code', () => {
    const error = new AppointmentAlreadyConfirmedError('appointment-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('APPOINTMENT_ALREADY_CONFIRMED');
    expect(error.message).toBe('Appointment appointment-1 is booked: nothing is left to confirm.');
  });
});

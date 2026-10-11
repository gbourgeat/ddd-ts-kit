import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AppointmentNotFoundError } from '@/contexts/scheduling/domain/errors/appointment-not-found.error';

describe('AppointmentNotFoundError', () => {
  it('carries its stable code', () => {
    const error = new AppointmentNotFoundError('appointment-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('APPOINTMENT_NOT_FOUND');
    expect(error.message).toBe('Appointment appointment-1 does not exist.');
  });
});

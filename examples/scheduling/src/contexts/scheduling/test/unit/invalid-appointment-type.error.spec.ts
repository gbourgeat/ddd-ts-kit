import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidAppointmentTypeError } from '@/contexts/scheduling/domain/errors/invalid-appointment-type.error.js';

describe('InvalidAppointmentTypeError', () => {
  it('carries its stable code', () => {
    const error = new InvalidAppointmentTypeError('lasts a positive number of minutes');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_APPOINTMENT_TYPE');
  });
});

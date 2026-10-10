import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownAppointmentTypeError } from '@/contexts/scheduling/domain/errors/unknown-appointment-type.error.js';

describe('UnknownAppointmentTypeError', () => {
  it('carries its stable code', () => {
    const error = new UnknownAppointmentTypeError('type-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNKNOWN_APPOINTMENT_TYPE');
  });
});

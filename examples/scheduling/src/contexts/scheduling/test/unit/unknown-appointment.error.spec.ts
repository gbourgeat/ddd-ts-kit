import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownAppointment } from '@/contexts/scheduling/domain/errors/unknown-appointment.error';

describe('UnknownAppointment', () => {
  it('refuses with the code APPOINTMENT_NOT_FOUND, its message and its facts', () => {
    const error = UnknownAppointment.forAppointment('appointment-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('APPOINTMENT_NOT_FOUND');
    expect(error.message).toBe('Appointment appointment-1 does not exist.');
    expect(error.facts).toEqual({ appointmentId: 'appointment-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

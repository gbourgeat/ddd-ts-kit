import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AppointmentAlreadyConfirmed } from '@/contexts/scheduling/calendars/domain/errors/appointment-already-confirmed.error';

describe('AppointmentAlreadyConfirmed', () => {
  it('refuses with the code APPOINTMENT_ALREADY_CONFIRMED, its message and its facts', () => {
    const error = AppointmentAlreadyConfirmed.forAppointment('appointment-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('APPOINTMENT_ALREADY_CONFIRMED');
    expect(error.message).toBe('Appointment appointment-1 is booked: nothing is left to confirm.');
    expect(error.facts).toEqual({ appointmentId: 'appointment-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AppointmentEnded } from '@/contexts/scheduling/domain/calendars/errors/appointment-ended.error';

describe('AppointmentEnded', () => {
  it('refuses with the code APPOINTMENT_ENDED, its message and its facts', () => {
    const error = AppointmentEnded.forAppointment('appointment-1', 'cancelled');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('APPOINTMENT_ENDED');
    expect(error.message).toBe('Appointment appointment-1 is cancelled and does not change any more.');
    expect(error.facts).toEqual({ appointmentId: 'appointment-1', status: 'cancelled' });
    expect(error.exposedFacts).toEqual({ status: 'cancelled' });
  });
});

import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AppointmentNotStarted } from '@/contexts/scheduling/domain/calendars/errors/appointment-not-started.error';

const startsAt = new Date('2026-03-02T09:00:00.000Z');

describe('AppointmentNotStarted', () => {
  it('refuses with the code APPOINTMENT_NOT_STARTED, its message and its facts', () => {
    const error = AppointmentNotStarted.forAppointment('appointment-1', startsAt);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('APPOINTMENT_NOT_STARTED');

    expect(error.message).toBe(
      'Appointment appointment-1 starts at 2026-03-02T09:00:00.000Z: its outcome is not known before.',
    );

    expect(error.facts).toEqual({ appointmentId: 'appointment-1', startsAt });
    expect(error.exposedFacts).toEqual({ startsAt });
  });
});

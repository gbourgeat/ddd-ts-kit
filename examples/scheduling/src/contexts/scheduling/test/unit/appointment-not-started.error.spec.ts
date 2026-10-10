import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AppointmentNotStartedError } from '#src/contexts/scheduling/domain/errors/appointment-not-started.error.js';

describe('AppointmentNotStartedError', () => {
  it('carries its stable code', () => {
    const error = new AppointmentNotStartedError('appointment-1', new Date('2026-03-02T09:00:00.000Z'));

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('APPOINTMENT_NOT_STARTED');

    expect(error.message).toBe(
      'Appointment appointment-1 starts at 2026-03-02T09:00:00.000Z: its outcome is not known before.',
    );
  });
});

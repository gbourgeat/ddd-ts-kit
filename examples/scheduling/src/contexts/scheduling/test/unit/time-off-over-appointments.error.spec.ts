import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { TimeOffOverAppointmentsError } from '@/contexts/scheduling/domain/errors/time-off-over-appointments.error.js';

describe('TimeOffOverAppointmentsError', () => {
  it('carries its stable code', () => {
    const error = new TimeOffOverAppointmentsError(2);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('TIME_OFF_OVER_APPOINTMENTS');
  });
});

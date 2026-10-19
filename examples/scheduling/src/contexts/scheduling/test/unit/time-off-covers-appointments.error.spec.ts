import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { TimeOffCoversAppointments } from '@/contexts/scheduling/domain/errors/time-off-covers-appointments.error';

describe('TimeOffCoversAppointments', () => {
  it('refuses with the code TIME_OFF_OVER_APPOINTMENTS, its message and its facts', () => {
    const error = TimeOffCoversAppointments.withCount(3);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('TIME_OFF_OVER_APPOINTMENTS');
    expect(error.message).toBe('The time off covers 3 active appointment(s).');
    expect(error.facts).toEqual({ held: 3 });
    expect(error.exposedFacts).toEqual({ held: 3 });
  });
});

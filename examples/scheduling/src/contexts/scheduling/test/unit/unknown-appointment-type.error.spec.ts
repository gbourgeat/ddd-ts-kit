import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownAppointmentType } from '@/contexts/scheduling/domain/calendars/errors/unknown-appointment-type.error';

describe('UnknownAppointmentType', () => {
  it('refuses with the code UNKNOWN_APPOINTMENT_TYPE, its message and its facts', () => {
    const error = UnknownAppointmentType.forAppointmentType('surgery');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNKNOWN_APPOINTMENT_TYPE');
    expect(error.message).toBe('The calendar offers no appointment type surgery.');
    expect(error.facts).toEqual({ appointmentTypeId: 'surgery' });
    expect(error.exposedFacts).toEqual({});
  });
});

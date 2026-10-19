import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidAppointmentType } from '@/contexts/scheduling/domain/errors/invalid-appointment-type.error';

describe('InvalidAppointmentType', () => {
  it('refuses with the code INVALID_APPOINTMENT_TYPE, its message and its facts', () => {
    const error = InvalidAppointmentType.forRule('lasts at least one minute');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_APPOINTMENT_TYPE');
    expect(error.message).toBe('An appointment type lasts at least one minute.');
    expect(error.facts).toEqual({ rule: 'lasts at least one minute' });
    expect(error.exposedFacts).toEqual({});
  });
});

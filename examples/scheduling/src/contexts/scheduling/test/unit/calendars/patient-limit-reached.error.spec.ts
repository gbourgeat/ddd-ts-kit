import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { PatientLimitReached } from '@/contexts/scheduling/calendars/domain/errors/patient-limit-reached.error';

describe('PatientLimitReached', () => {
  it('refuses with the code PATIENT_LIMIT_REACHED, its message and its facts', () => {
    const error = PatientLimitReached.atLimit(2);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('PATIENT_LIMIT_REACHED');
    expect(error.message).toBe('The patient already holds 2 future appointments with this practitioner.');
    expect(error.facts).toEqual({ limit: 2 });
    expect(error.exposedFacts).toEqual({ limit: 2 });
  });
});

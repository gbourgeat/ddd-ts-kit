import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { PatientLimitReachedError } from '@/contexts/scheduling/domain/errors/patient-limit-reached.error';

describe('PatientLimitReachedError', () => {
  it('carries its stable code', () => {
    const error = new PatientLimitReachedError(3);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('PATIENT_LIMIT_REACHED');
    expect(error.message).toBe('The patient already holds 3 future appointments with this practitioner.');
  });
});

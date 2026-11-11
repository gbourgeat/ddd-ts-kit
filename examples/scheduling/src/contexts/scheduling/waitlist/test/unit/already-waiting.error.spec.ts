import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AlreadyWaiting } from '@/contexts/scheduling/waitlist/domain/errors/already-waiting.error';

describe('AlreadyWaiting', () => {
  it('refuses with the code ALREADY_WAITING, its message and its facts', () => {
    const error = AlreadyWaiting.forPatient('patient-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('ALREADY_WAITING');
    expect(error.message).toBe('The patient patient-1 is already on this waitlist.');
    expect(error.facts).toEqual({ patientId: 'patient-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

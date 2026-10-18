import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { NoDocument } from '@/contexts/scheduling/domain/errors/no-document.error';

describe('NoDocument', () => {
  it('refuses to read or remove the document of an appointment that holds none, keeping which appointment to itself', () => {
    const error = NoDocument.forAppointment('appointment-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('NO_DOCUMENT');
    expect(error.message).toBe('Appointment appointment-1 holds no document.');
    expect([error.facts, error.exposedFacts]).toEqual([{ appointmentId: 'appointment-1' }, {}]);
  });
});

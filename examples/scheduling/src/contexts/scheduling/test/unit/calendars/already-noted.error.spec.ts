import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AlreadyNoted } from '@/contexts/scheduling/calendars/domain/errors/already-noted.error';

describe('AlreadyNoted', () => {
  it('refuses "already noted" with the code ALREADY_NOTED and the appointment', () => {
    const error = AlreadyNoted.forAppointment('appointment-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('ALREADY_NOTED');
    expect(error.message).toBe('The appointment appointment-1 is already noted in this attendance record.');
    expect(error.facts).toEqual({ appointmentId: 'appointment-1' });
  });
});

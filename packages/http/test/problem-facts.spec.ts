import { ConceptError, DomainRefusal } from '@ddd-ts-kit/kernel';
import { describe, expect, it } from 'vitest';
import { createErrorMapper, toProblem } from '../src';
import { PROBLEM_SCHEMA } from '../src/openapi/problem-schema';

class BookingError extends ConceptError {
  static slotTaken(patientId: string, startsAt: Date) {
    return BookingError.refusal('SLOT_TAKEN', 'The slot is already held.', { patientId, startsAt }).exposing(
      'startsAt',
    );
  }

  static patientLimitReached(patientId: string) {
    return BookingError.refusal('PATIENT_LIMIT_REACHED', 'The patient holds too many appointments.', { patientId });
  }

  static unknownPatient(patientId: string, seenAt: Date, attempts: readonly number[]) {
    return BookingError.refusal('UNKNOWN_PATIENT', `No patient ${patientId} at ${seenAt.toISOString()}.`, {
      patientId,
      seenAt,
      attempts,
      urgent: true,
    });
  }

  static agendaUnreadable(shard: string) {
    return BookingError.refusal('AGENDA_UNREADABLE', 'The agenda cannot be read.', { shard }).exposing('shard');
  }
}

class PatientUnknown extends DomainRefusal {
  readonly code = 'PATIENT_UNKNOWN';

  static forPatient(patientId: string, startsAt: Date) {
    return PatientUnknown.refusal(`No patient ${patientId}.`, { patientId, startsAt }).exposing('startsAt');
  }
}

describe('the facts of a refusal in the problem document', () => {
  const mapper = createErrorMapper({ SLOT_TAKEN: 409, AGENDA_UNREADABLE: 503 });
  const startsAt = new Date('2026-03-02T09:00:00.000Z');

  it('writes the facts the factory exposed under `facts`, and no other', () => {
    const problem = toProblem(BookingError.slotTaken('patient-7', startsAt), mapper, 'req-1');

    expect(problem).toEqual({
      type: 'urn:problem:slot-taken',
      title: 'Conflict',
      status: 409,
      code: 'SLOT_TAKEN',
      detail: 'The slot is already held.',
      facts: { startsAt },
      requestId: 'req-1',
    });

    expect(JSON.stringify(problem)).not.toContain('patient-7');
  });

  it('writes no `facts` member when the factory exposed none: a fact is private by default', () => {
    const problem = toProblem(BookingError.patientLimitReached('patient-7'), mapper, 'req-1');

    expect(problem).not.toHaveProperty('facts');
    expect(JSON.stringify(problem)).not.toContain('patient-7');
  });

  it('answers a sentence made from the code when the message quotes a fact the factory did not expose', () => {
    const quoted = toProblem(BookingError.unknownPatient('patient-7', startsAt, []), mapper, 'req-1');
    const byInstant = toProblem(BookingError.unknownPatient('', startsAt, []), mapper, 'req-1');
    const byNumber = toProblem(BookingError.unknownPatient('', new Date(0), [2026]), mapper, 'req-1');
    const unquoted = toProblem(BookingError.patientLimitReached('patient-7'), mapper, 'req-1');

    expect([quoted.detail, byInstant.detail, byNumber.detail]).toEqual(Array(3).fill('Unknown patient.'));
    expect(JSON.stringify(quoted)).not.toContain('patient-7');
    expect(unquoted.detail).toBe('The patient holds too many appointments.');
    expect(toProblem(new Error('boom'), mapper, 'req-1')).not.toHaveProperty('detail');
  });

  it('hides a refusal mapped to a server fault, its exposed facts included', () => {
    const problem = toProblem(BookingError.agendaUnreadable('shard-3'), mapper, 'req-1');

    expect(problem).toEqual({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      code: 'AGENDA_UNREADABLE',
      requestId: 'req-1',
    });
  });

  it('documents the member in the contract', () => {
    expect(PROBLEM_SCHEMA['properties']).toHaveProperty('facts.type', 'object');
    expect(PROBLEM_SCHEMA['required']).not.toContain('facts');
  });

  it('writes the exposed facts of a refusal of its own class, and hides the message that quotes a private one', () => {
    const problem = toProblem(PatientUnknown.forPatient('patient-7', startsAt), mapper, 'req-1');

    expect(problem).toMatchObject({ code: 'PATIENT_UNKNOWN', detail: 'Patient unknown.', facts: { startsAt } });
    expect(JSON.stringify(problem)).not.toContain('patient-7');
  });
});

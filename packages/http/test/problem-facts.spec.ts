import { ConceptError } from '@ddd-ts-kit/kernel';
import { describe, expect, it } from 'vitest';
import { createErrorMapper, toProblem } from '../src/index.js';
import { PROBLEM_SCHEMA } from '../src/openapi/problem-schema.js';

class BookingError extends ConceptError {
  static slotTaken(patientId: string, startsAt: Date) {
    return BookingError.refusal('SLOT_TAKEN', 'The slot is already held.', { patientId, startsAt }).exposing(
      'startsAt',
    );
  }

  static patientLimitReached(patientId: string) {
    return BookingError.refusal('PATIENT_LIMIT_REACHED', 'The patient holds too many appointments.', { patientId });
  }

  static agendaUnreadable(shard: string) {
    return BookingError.refusal('AGENDA_UNREADABLE', 'The agenda cannot be read.', { shard }).exposing('shard');
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
});

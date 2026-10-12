import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { WaitlistError } from '@/contexts/scheduling/domain/errors/waitlist.error';

const refusals = [
  {
    refusal: WaitlistError.alreadyWaiting('patient-1'),
    code: 'ALREADY_WAITING',
    message: 'The patient patient-1 is already on this waitlist.',
    facts: { patientId: 'patient-1' },
    exposed: {},
  },
  {
    refusal: WaitlistError.invalidOffer('expires before its slot starts'),
    code: 'INVALID_OFFER',
    message: 'An offer expires before its slot starts.',
    facts: { rule: 'expires before its slot starts' },
    exposed: {},
  },
  {
    refusal: WaitlistError.invalidWaiter('names a patient'),
    code: 'INVALID_WAITER',
    message: 'A waiter names a patient.',
    facts: { rule: 'names a patient' },
    exposed: {},
  },
];

describe('WaitlistError', () => {
  it.each(refusals)('refuses with $code, its message and its facts', ({ refusal, code, message, facts, exposed }) => {
    expect(refusal).toBeInstanceOf(DomainError);
    expect({ code: refusal.code, message: refusal.message, facts: refusal.facts }).toEqual({ code, message, facts });
    expect(refusal.exposedFacts).toEqual(exposed);
  });

  it('gives each refusal a code of its own', () => {
    expect(new Set(refusals.map(({ code }) => code)).size).toBe(refusals.length);
  });
});

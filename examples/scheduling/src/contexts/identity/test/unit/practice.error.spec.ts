import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { PracticeError } from '@/contexts/identity/domain/errors/practice.error';

const refusals = [
  {
    refusal: PracticeError.alreadyMember('person-1'),
    code: 'ALREADY_MEMBER',
    message: 'The person person-1 is already a member of this practice.',
    facts: { personId: 'person-1' },
    exposed: {},
  },
  {
    refusal: PracticeError.notAMember('person-1'),
    code: 'NOT_A_MEMBER',
    message: 'The person person-1 is not a member of this practice.',
    facts: { personId: 'person-1' },
    exposed: {},
  },
  {
    refusal: PracticeError.notAPractitioner('person-1'),
    code: 'NOT_A_PRACTITIONER',
    message: 'The person person-1 is not a practitioner of this practice.',
    facts: { personId: 'person-1' },
    exposed: {},
  },
  {
    refusal: PracticeError.notAnAssistant('person-1'),
    code: 'NOT_AN_ASSISTANT',
    message: 'The person person-1 is not an assistant of this practice.',
    facts: { personId: 'person-1' },
    exposed: {},
  },
  {
    refusal: PracticeError.lastManager(),
    code: 'LAST_MANAGER',
    message: 'A practice keeps at least one manager: its last manager cannot be removed.',
    facts: {},
    exposed: {},
  },
  {
    refusal: PracticeError.notFound('practice-1'),
    code: 'PRACTICE_NOT_FOUND',
    message: 'The practice practice-1 does not exist.',
    facts: { practiceId: 'practice-1' },
    exposed: {},
  },
  {
    refusal: PracticeError.unknownRole('owner'),
    code: 'UNKNOWN_ROLE',
    message: '"owner" is not a role of a practice: manager, practitioner or assistant.',
    facts: { value: 'owner' },
    exposed: {},
  },
  {
    refusal: PracticeError.unknownTimeZone('Mars/Olympus'),
    code: 'UNKNOWN_TIME_ZONE',
    message: '"Mars/Olympus" is not an IANA time zone.',
    facts: { value: 'Mars/Olympus' },
    exposed: {},
  },
];

describe('PracticeError', () => {
  it.each(refusals)('refuses with $code, its message and its facts', ({ refusal, code, message, facts, exposed }) => {
    expect(refusal).toBeInstanceOf(DomainError);
    expect({ code: refusal.code, message: refusal.message, facts: refusal.facts }).toEqual({ code, message, facts });
    expect(refusal.exposedFacts).toEqual(exposed);
  });

  it('gives each refusal a code of its own', () => {
    expect(new Set(refusals.map(({ code }) => code)).size).toBe(refusals.length);
  });
});

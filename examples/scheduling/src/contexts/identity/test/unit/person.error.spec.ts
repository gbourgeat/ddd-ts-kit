import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { PersonError } from '@/contexts/identity/domain/errors/person.error';

const refusals = [
  {
    refusal: PersonError.invalidDisplayName(),
    code: 'INVALID_DISPLAY_NAME',
    message: 'A display name holds between 1 and 120 characters.',
    facts: {},
    exposed: {},
  },
  {
    refusal: PersonError.invalidEmail('ada@'),
    code: 'INVALID_EMAIL',
    message: '"ada@" is not an address the platform can write to.',
    facts: { value: 'ada@' },
    exposed: {},
  },
  {
    refusal: PersonError.notRegistered('person-1'),
    code: 'PERSON_NOT_REGISTERED',
    message: 'The person person-1 is not registered.',
    facts: { personId: 'person-1' },
    exposed: {},
  },
];

describe('PersonError', () => {
  it.each(refusals)('refuses with $code, its message and its facts', ({ refusal, code, message, facts, exposed }) => {
    expect(refusal).toBeInstanceOf(DomainError);
    expect({ code: refusal.code, message: refusal.message, facts: refusal.facts }).toEqual({ code, message, facts });
    expect(refusal.exposedFacts).toEqual(exposed);
  });

  it('gives each refusal a code of its own', () => {
    expect(new Set(refusals.map(({ code }) => code)).size).toBe(refusals.length);
  });
});

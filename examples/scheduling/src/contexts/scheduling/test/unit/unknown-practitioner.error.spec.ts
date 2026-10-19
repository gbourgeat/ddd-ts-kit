import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownPractitioner } from '@/contexts/scheduling/domain/errors/unknown-practitioner.error';

describe('UnknownPractitioner', () => {
  it('refuses with the code UNKNOWN_PRACTITIONER, its message and its facts', () => {
    const error = UnknownPractitioner.atPractice('practice-1', 'person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNKNOWN_PRACTITIONER');
    expect(error.message).toBe('The person person-1 is not a practitioner of the practice practice-1.');
    expect(error.facts).toEqual({ practiceId: 'practice-1', practitionerId: 'person-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

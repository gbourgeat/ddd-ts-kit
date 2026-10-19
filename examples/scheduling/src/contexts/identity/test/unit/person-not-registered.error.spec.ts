import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { PersonNotRegistered } from '@/contexts/identity/domain/errors/person-not-registered.error';

describe('PersonNotRegistered', () => {
  it('refuses with the code PERSON_NOT_REGISTERED, its message and its facts', () => {
    const error = PersonNotRegistered.forPerson('person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('PERSON_NOT_REGISTERED');
    expect(error.message).toBe('The person person-1 is not registered.');
    expect(error.facts).toEqual({ personId: 'person-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

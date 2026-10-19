import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { NotAPractitioner } from '@/contexts/identity/domain/errors/not-a-practitioner.error';

describe('NotAPractitioner', () => {
  it('refuses with the code NOT_A_PRACTITIONER, its message and its facts', () => {
    const error = NotAPractitioner.forPerson('person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('NOT_A_PRACTITIONER');
    expect(error.message).toBe('The person person-1 is not a practitioner of this practice.');
    expect(error.facts).toEqual({ personId: 'person-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

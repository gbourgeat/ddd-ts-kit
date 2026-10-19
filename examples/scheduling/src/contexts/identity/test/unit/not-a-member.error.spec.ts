import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { NotAMember } from '@/contexts/identity/domain/errors/not-a-member.error';

describe('NotAMember', () => {
  it('refuses with the code NOT_A_MEMBER, its message and its facts', () => {
    const error = NotAMember.forPerson('person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('NOT_A_MEMBER');
    expect(error.message).toBe('The person person-1 is not a member of this practice.');
    expect(error.facts).toEqual({ personId: 'person-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

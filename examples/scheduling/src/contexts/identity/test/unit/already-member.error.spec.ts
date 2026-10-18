import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AlreadyMember } from '@/contexts/identity/domain/errors/already-member.error';

describe('AlreadyMember', () => {
  it('refuses with the code ALREADY_MEMBER, its message and its facts', () => {
    const error = AlreadyMember.forPerson('person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('ALREADY_MEMBER');
    expect(error.message).toBe('The person person-1 is already a member of this practice.');
    expect(error.facts).toEqual({ personId: 'person-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

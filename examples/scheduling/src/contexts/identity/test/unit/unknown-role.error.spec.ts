import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownRole } from '@/contexts/identity/domain/errors/unknown-role.error';

describe('UnknownRole', () => {
  it('refuses with the code UNKNOWN_ROLE, its message and its facts', () => {
    const error = UnknownRole.forName('owner');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNKNOWN_ROLE');
    expect(error.message).toBe('"owner" is not a role of a practice: manager, practitioner or assistant.');
    expect(error.facts).toEqual({ value: 'owner' });
    expect(error.exposedFacts).toEqual({});
  });
});

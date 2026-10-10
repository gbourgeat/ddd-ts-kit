import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { NotAMemberError } from '@/contexts/identity/domain/errors/not-a-member.error.js';

describe('NotAMemberError', () => {
  it('carries its stable code', () => {
    const error = new NotAMemberError('person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('NOT_A_MEMBER');
  });
});

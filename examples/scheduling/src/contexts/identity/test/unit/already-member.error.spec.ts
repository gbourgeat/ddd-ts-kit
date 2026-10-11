import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { AlreadyMemberError } from '@/contexts/identity/domain/errors/already-member.error';

describe('AlreadyMemberError', () => {
  it('carries its stable code', () => {
    const error = new AlreadyMemberError('person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('ALREADY_MEMBER');
  });
});

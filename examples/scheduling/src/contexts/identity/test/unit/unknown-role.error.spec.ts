import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownRoleError } from '#src/contexts/identity/domain/errors/unknown-role.error.js';

describe('UnknownRoleError', () => {
  it('carries its stable code', () => {
    const error = new UnknownRoleError('sample');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNKNOWN_ROLE');
  });
});

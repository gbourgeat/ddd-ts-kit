import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidEmailError } from '@/contexts/identity/domain/errors/invalid-email.error';

describe('InvalidEmailError', () => {
  it('carries its stable code', () => {
    const error = new InvalidEmailError('sample');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_EMAIL');
  });
});

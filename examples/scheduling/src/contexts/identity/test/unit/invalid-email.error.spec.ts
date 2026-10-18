import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidEmail } from '@/contexts/identity/domain/errors/invalid-email.error';

describe('InvalidEmail', () => {
  it('refuses with the code INVALID_EMAIL, its message and its facts', () => {
    const error = InvalidEmail.forAddress('ada@');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_EMAIL');
    expect(error.message).toBe('"ada@" is not an address the platform can write to.');
    expect(error.facts).toEqual({ value: 'ada@' });
    expect(error.exposedFacts).toEqual({});
  });
});

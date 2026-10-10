import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { PersonNotRegisteredError } from '@/contexts/identity/domain/errors/person-not-registered.error.js';

describe('PersonNotRegisteredError', () => {
  it('carries its stable code', () => {
    const error = new PersonNotRegisteredError('person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('PERSON_NOT_REGISTERED');
  });
});

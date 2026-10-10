import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { NotAPractitionerError } from '@/contexts/identity/domain/errors/not-a-practitioner.error.js';

describe('NotAPractitionerError', () => {
  it('carries its stable code', () => {
    const error = new NotAPractitionerError('person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('NOT_A_PRACTITIONER');
  });
});

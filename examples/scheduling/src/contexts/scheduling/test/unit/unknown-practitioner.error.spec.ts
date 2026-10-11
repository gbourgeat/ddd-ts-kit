import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownPractitionerError } from '@/contexts/scheduling/domain/errors/unknown-practitioner.error';

describe('UnknownPractitionerError', () => {
  it('carries its stable code', () => {
    const error = new UnknownPractitionerError('practice-1', 'person-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNKNOWN_PRACTITIONER');
  });
});

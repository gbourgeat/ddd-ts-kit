import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { PracticeNotFoundError } from '@/contexts/identity/domain/errors/practice-not-found.error.js';

describe('PracticeNotFoundError', () => {
  it('carries its stable code', () => {
    const error = new PracticeNotFoundError('practice-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('PRACTICE_NOT_FOUND');
  });
});

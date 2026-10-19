import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownPractice } from '@/contexts/identity/domain/errors/unknown-practice.error';

describe('UnknownPractice', () => {
  it('refuses with the code PRACTICE_NOT_FOUND, its message and its facts', () => {
    const error = UnknownPractice.forPractice('practice-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('PRACTICE_NOT_FOUND');
    expect(error.message).toBe('The practice practice-1 does not exist.');
    expect(error.facts).toEqual({ practiceId: 'practice-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

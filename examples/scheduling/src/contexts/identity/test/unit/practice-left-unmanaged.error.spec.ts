import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { PracticeLeftUnmanaged } from '@/contexts/identity/domain/errors/practice-left-unmanaged.error';

describe('PracticeLeftUnmanaged', () => {
  it('refuses with the code LAST_MANAGER, its message and its facts', () => {
    const error = PracticeLeftUnmanaged.onRemoval();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('LAST_MANAGER');
    expect(error.message).toBe('A practice keeps at least one manager: its last manager cannot be removed.');
    expect(error.facts).toEqual({});
    expect(error.exposedFacts).toEqual({});
  });
});

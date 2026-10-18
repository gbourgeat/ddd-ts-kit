import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidDisplayName } from '@/contexts/identity/domain/errors/invalid-display-name.error';

describe('InvalidDisplayName', () => {
  it('refuses with the code INVALID_DISPLAY_NAME, its message and its facts', () => {
    const error = InvalidDisplayName.becauseOfLength();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_DISPLAY_NAME');
    expect(error.message).toBe('A display name holds between 1 and 120 characters.');
    expect(error.facts).toEqual({});
    expect(error.exposedFacts).toEqual({});
  });
});

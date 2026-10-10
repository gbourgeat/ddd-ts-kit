import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidDisplayNameError } from '@/contexts/identity/domain/errors/invalid-display-name.error.js';

describe('InvalidDisplayNameError', () => {
  it('carries its stable code', () => {
    const error = new InvalidDisplayNameError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_DISPLAY_NAME');
  });
});

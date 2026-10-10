import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { PracticeLeftUnmanagedError } from '../../domain/errors/practice-left-unmanaged.error.js';

describe('PracticeLeftUnmanagedError', () => {
  it('carries its stable code', () => {
    const error = new PracticeLeftUnmanagedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('LAST_MANAGER');
  });
});

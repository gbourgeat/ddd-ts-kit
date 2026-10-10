import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { OffGridError } from '../../domain/errors/off-grid.error.js';

describe('OffGridError', () => {
  it('carries its stable code', () => {
    const error = new OffGridError(30);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('OFF_GRID');
  });
});

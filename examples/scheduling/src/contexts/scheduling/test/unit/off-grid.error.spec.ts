import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { OffGridError } from '@/contexts/scheduling/domain/errors/off-grid.error';

describe('OffGridError', () => {
  it('carries its stable code', () => {
    const error = new OffGridError(30);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('OFF_GRID');
  });
});

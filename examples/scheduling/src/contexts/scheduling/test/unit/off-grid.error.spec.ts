import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { OffGrid } from '@/contexts/scheduling/domain/errors/off-grid.error';

describe('OffGrid', () => {
  it('refuses with the code OFF_GRID, its message and its facts', () => {
    const error = OffGrid.forGrid(15);

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('OFF_GRID');
    expect(error.message).toBe('An appointment of this type starts on a step of 15 minutes from midnight.');
    expect(error.facts).toEqual({ grid: 15 });
    expect(error.exposedFacts).toEqual({ grid: 15 });
  });
});

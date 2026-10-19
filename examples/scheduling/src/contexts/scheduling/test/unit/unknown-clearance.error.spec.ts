import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { UnknownClearance } from '@/contexts/scheduling/domain/errors/unknown-clearance.error';

describe('UnknownClearance', () => {
  it('refuses with the code UNKNOWN_CLEARANCE, its message and its facts', () => {
    const error = UnknownClearance.forClearance('clearance-1');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('UNKNOWN_CLEARANCE');
    expect(error.message).toBe('There is no clearance clearance-1.');
    expect(error.facts).toEqual({ clearanceId: 'clearance-1' });
    expect(error.exposedFacts).toEqual({});
  });
});

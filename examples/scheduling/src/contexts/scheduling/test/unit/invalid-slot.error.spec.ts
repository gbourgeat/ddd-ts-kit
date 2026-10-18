import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidSlot } from '@/contexts/scheduling/domain/errors/invalid-slot.error';

describe('InvalidSlot', () => {
  it('refuses with the code INVALID_SLOT, its message and its facts', () => {
    const error = InvalidSlot.forRule('ends before it starts');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_SLOT');
    expect(error.message).toBe('A slot ends before it starts.');
    expect(error.facts).toEqual({ reason: 'ends before it starts' });
    expect(error.exposedFacts).toEqual({});
  });
});

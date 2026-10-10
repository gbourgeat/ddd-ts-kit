import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { InvalidSlotError } from '#src/contexts/scheduling/domain/errors/invalid-slot.error.js';

describe('InvalidSlotError', () => {
  it('carries its stable code', () => {
    const error = new InvalidSlotError('ends after it starts');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('INVALID_SLOT');
    expect(error.message).toBe('A slot ends after it starts.');
  });
});

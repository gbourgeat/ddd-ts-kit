import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { SlotTakenError } from '@/contexts/scheduling/domain/errors/slot-taken.error';

describe('SlotTakenError', () => {
  it('carries its stable code', () => {
    const error = new SlotTakenError('calendar-1', new Date('2026-03-02T09:00:00.000Z'));

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('SLOT_TAKEN');
    expect(error.message).toBe('The slot starting at 2026-03-02T09:00:00.000Z on calendar calendar-1 is already held.');
  });
});

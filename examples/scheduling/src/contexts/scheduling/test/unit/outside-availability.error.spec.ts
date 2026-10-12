import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { OutsideAvailabilityError } from '@/contexts/scheduling/domain/errors/outside-availability.error';

describe('OutsideAvailabilityError', () => {
  it('carries its stable code', () => {
    const error = new OutsideAvailabilityError(new Date('2026-03-02T08:00:00.000Z'));

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('OUTSIDE_AVAILABILITY');
  });
});

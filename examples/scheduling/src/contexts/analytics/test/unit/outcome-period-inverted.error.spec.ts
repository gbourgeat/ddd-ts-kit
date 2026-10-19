import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { OutcomePeriodInverted } from '@/contexts/analytics/domain/errors/outcome-period-inverted.error';

describe('OutcomePeriodInverted', () => {
  it('refuses an outcome that ends before it starts with the code OUTCOME_ENDS_BEFORE_START', () => {
    const error = OutcomePeriodInverted.forPeriod('2026-03-02T09:30:00.000Z', '2026-03-02T09:00:00.000Z');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('OUTCOME_ENDS_BEFORE_START');
    expect(error.facts).toEqual({ startsAt: '2026-03-02T09:30:00.000Z', endsAt: '2026-03-02T09:00:00.000Z' });
  });
});

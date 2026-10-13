import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { OccupancyError } from '@/contexts/analytics/domain/errors/occupancy.error';

describe('OccupancyError', () => {
  it('refuses an outcome that ends before it starts with the code OUTCOME_ENDS_BEFORE_START', () => {
    const error = OccupancyError.outcomeEndsBeforeStart('2026-03-02T09:30:00.000Z', '2026-03-02T09:00:00.000Z');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('OUTCOME_ENDS_BEFORE_START');
    expect(error.facts).toEqual({ startsAt: '2026-03-02T09:30:00.000Z', endsAt: '2026-03-02T09:00:00.000Z' });
  });

  it('refuses inconsistent figures with the code FIGURES_INCONSISTENT and the rule they break', () => {
    const error = OccupancyError.figuresInconsistent('count nothing below zero');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('FIGURES_INCONSISTENT');
    expect(error.message).toBe('The figures of a line of occupancy count nothing below zero.');
    expect(error.facts).toEqual({ rule: 'count nothing below zero' });
  });
});

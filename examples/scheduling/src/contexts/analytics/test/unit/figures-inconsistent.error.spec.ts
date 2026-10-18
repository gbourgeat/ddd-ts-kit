import { describe, expect, it } from 'vitest';
import { DomainError } from '@ddd-ts-kit/kernel';
import { FiguresInconsistent } from '@/contexts/analytics/domain/errors/figures-inconsistent.error';

describe('FiguresInconsistent', () => {
  it('refuses inconsistent figures with the code FIGURES_INCONSISTENT and the rule they break', () => {
    const error = FiguresInconsistent.forRule('count nothing below zero');

    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe('FIGURES_INCONSISTENT');
    expect(error.message).toBe('The figures of a line of occupancy count nothing below zero.');
    expect(error.facts).toEqual({ rule: 'count nothing below zero' });
  });
});

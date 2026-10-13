import { describe, expect, it } from 'vitest';
import { expectRefusal } from '@ddd-ts-kit/testing';
import { MeasuredOutcome } from '@/contexts/analytics/domain/value-objects/measured-outcome.vo';

const NINE = new Date('2026-10-12T09:00:00.000Z');

describe('MeasuredOutcome', () => {
  it('is equal to another outcome in the same state over the same time', () => {
    const first = MeasuredOutcome.of('held', NINE, later(30));

    expect(first.equals(MeasuredOutcome.of('held', new Date(NINE), later(30)))).toBe(true);
    expect(first.equals(MeasuredOutcome.of('completed', NINE, later(30)))).toBe(false);
    expect(first.equals(MeasuredOutcome.of('held', NINE, later(45)))).toBe(false);
  });

  it('covers its time to the nearest minute', () => {
    expect(MeasuredOutcome.of('held', NINE, later(20.5)).minutes).toBe(21);
    expect(MeasuredOutcome.of('held', NINE, later(10.4)).minutes).toBe(10);
  });

  it('tells whether it stands in one of the states asked for', () => {
    const missed = MeasuredOutcome.of('no-show', NINE, later(15));

    expect(missed.state).toBe('no-show');
    expect(missed.isIn(['held', 'no-show'])).toBe(true);
    expect(missed.isIn(['cancelled-by-patient'])).toBe(false);
  });

  it('covers no time when it ends as it starts, and refuses an end before its start', () => {
    expect(MeasuredOutcome.of('held', NINE, NINE).minutes).toBe(0);
    expectRefusal(() => MeasuredOutcome.of('held', later(30), NINE), 'OUTCOME_ENDS_BEFORE_START');
  });

  it('keeps its own copy of the instants it was given', () => {
    const start = new Date(NINE);
    const outcome = MeasuredOutcome.of('held', start, later(30));

    start.setTime(0);

    expect(outcome.minutes).toBe(30);
  });
});

function later(minutes: number): Date {
  return new Date(NINE.getTime() + minutes * 60_000);
}

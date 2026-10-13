import { describe, expect, it } from 'vitest';
import { OpeningHours } from '@/contexts/scheduling/domain/value-objects/opening-hours.vo';
import { Range } from '@/contexts/scheduling/domain/value-objects/range.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

const morning = range('09:00', '12:00');
const afternoon = range('14:00', '18:00');

describe('OpeningHours', () => {
  it('is equal to other hours with the same ranges on the same days', () => {
    const first = OpeningHours.create({ monday: [morning, afternoon] });

    expect(first.equals(OpeningHours.create({ monday: [afternoon, morning] }))).toBe(true);
    expect(first.equals(OpeningHours.create({ tuesday: [morning, afternoon] }))).toBe(false);
  });

  it('refuses two ranges of one day that share a minute', () => {
    expectRefusal(
      () => OpeningHours.create({ monday: [morning], friday: [morning, range('11:00', '15:00')] }),
      'INVALID_RANGE',
    );
  });

  it('accepts the same range on two different days', () => {
    expect(() => OpeningHours.create({ monday: [morning], tuesday: [morning] })).not.toThrow();
  });

  it.each([
    ['2026-03-02', 'a Monday', ['09:00', '14:00']],
    ['2026-03-03', 'a Tuesday', []],
    ['2026-03-08', 'a Sunday', ['10:00']],
  ])('gives the ranges of %s, %s, in the order of the day', (day, _weekday, starts) => {
    const hours = OpeningHours.create({ monday: [afternoon, morning], sunday: [range('10:00', '11:00')] });

    expect(hours.rangesOn(day).map((open) => open.start)).toEqual(starts);
  });

  it('opens nothing when closed', () => {
    expect(OpeningHours.closed().rangesOn('2026-03-02')).toEqual([]);
    expect(OpeningHours.closed().equals(OpeningHours.create({}))).toBe(true);
  });
});

function range(start: string, end: string): Range {
  return Range.create(start, end);
}

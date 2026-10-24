import { Range } from '@/contexts/scheduling/calendars/domain/value-objects/range.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

describe('Range', () => {
  it('is equal to another range between the same times', () => {
    expect(range('09:00', '12:00').equals(range('09:00', '12:00'))).toBe(true);
    expect(range('09:00', '12:00').equals(range('09:00', '12:30'))).toBe(false);
  });

  it.each([
    ['09:00', '12:00', { startMinute: 540, endMinute: 720 }],
    ['00:00', '24:00', { startMinute: 0, endMinute: 1440 }],
    [' 13:30 ', '13:45', { startMinute: 810, endMinute: 825 }],
  ])('accepts %s to %s', (start, end, minutes) => {
    expect(range(start, end)).toMatchObject(minutes);
  });

  it.each([
    ['12:00', '09:00'],
    ['09:00', '09:00'],
    ['9:00', '12:00'],
    ['09:60', '12:00'],
    ['09:00', '24:30'],
    ['', '12:00'],
  ])('refuses %j to %j as an invalid range', (start, end) => {
    expectRefusal(() => Range.create(start, end), 'INVALID_RANGE');
  });

  it('overlaps another range in both directions or in none, for any two ranges', () => {
    fc.assert(fc.property(anyRange(), anyRange(), (one, other) => one.overlaps(other) === other.overlaps(one)));
  });

  it('is disjoint from another range exactly when neither overlaps the other, for any two ranges', () => {
    fc.assert(
      fc.property(anyRange(), anyRange(), (one, other) => Range.disjoint([one, other]) === !one.overlaps(other)),
    );
  });

  it('is written back as its two times', () => {
    const morning = range('09:05', '24:00');

    expect([morning.start, morning.end]).toEqual(['09:05', '24:00']);
  });

  it('overlaps a range it shares a minute with, and not the one that starts when it ends', () => {
    expect(range('09:00', '12:00').overlaps(range('11:59', '14:00'))).toBe(true);
    expect(range('09:00', '12:00').overlaps(range('12:00', '14:00'))).toBe(false);
  });

  it('contains a span that lies whole inside it, bounds included', () => {
    const morning = range('09:00', '12:00');

    expect(morning.contains(540, 720)).toBe(true);
    expect(morning.contains(690, 721)).toBe(false);
    expect(morning.contains(539, 600)).toBe(false);
  });

  it('says whether ranges share no minute', () => {
    expect(Range.disjoint([range('09:00', '12:00'), range('14:00', '18:00'), range('12:00', '13:00')])).toBe(true);
    expect(Range.disjoint([range('09:00', '12:00'), range('14:00', '18:00'), range('11:00', '15:00')])).toBe(false);
  });
});

function range(start: string, end: string): Range {
  return Range.create(start, end);
}

/** Any range of the day: a start and an end in minutes from midnight, the end after the start. */
function anyRange(): fc.Arbitrary<Range> {
  return fc
    .tuple(fc.integer({ min: 0, max: 1439 }), fc.integer({ min: 1, max: 1440 }))
    .filter(([start, end]) => start < end)
    .map(([start, end]) => Range.create(clock(start), clock(end)));
}

function clock(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { UnknownTimeZoneError } from '@/contexts/scheduling/domain/errors/unknown-time-zone.error.js';
import { TimeZone } from '@/contexts/scheduling/domain/value-objects/time-zone.vo.js';

const paris = unwrap(TimeZone.create('Europe/Paris'));

describe('TimeZone', () => {
  it('is equal to another time zone with the same name', () => {
    expect(paris.equals(unwrap(TimeZone.create('Europe/Paris')))).toBe(true);
    expect(paris.equals(unwrap(TimeZone.create('America/New_York')))).toBe(false);
  });

  it.each(['  ', 'Mars/Olympus', 'Paris'])('refuses %j, which is not a known zone', (name) => {
    const result = TimeZone.create(name);

    expect(result).toMatchObject({ ok: false, error: expect.any(UnknownTimeZoneError) });
  });

  it('writes a zone the way the zone database does, whatever the case it was given in', () => {
    expect(unwrap(TimeZone.create(' europe/paris ')).name).toBe('Europe/Paris');
  });

  it.each([
    ['2026-01-15T22:59:00.000Z', '2026-01-15'],
    ['2026-01-15T23:00:00.000Z', '2026-01-16'],
    ['2026-07-15T21:59:00.000Z', '2026-07-15'],
    ['2026-07-15T22:00:00.000Z', '2026-07-16'],
  ])('reads the day of %s on the wall clock of Paris as %s', (instant, day) => {
    expect(paris.dayOf(new Date(instant))).toBe(day);
  });

  it.each([
    ['2026-01-15T08:30:00.000Z', 9 * 60 + 30],
    ['2026-07-15T08:30:00.000Z', 10 * 60 + 30],
    ['2026-03-29T00:59:00.000Z', 60 + 59],
    ['2026-03-29T01:00:00.000Z', 3 * 60],
    ['2026-10-25T00:30:00.000Z', 2 * 60 + 30],
    ['2026-10-25T01:30:00.000Z', 2 * 60 + 30],
    ['2026-01-15T23:00:00.000Z', 0],
  ])('reads the minute of %s on the wall clock of Paris as %i', (instant, minute) => {
    expect(paris.minuteOf(new Date(instant))).toBe(minute);
  });

  it.each([
    ['an ordinary winter day', ['2026-01-15', 9 * 60], '2026-01-15T08:00:00.000Z'],
    ['an ordinary summer day', ['2026-07-15', 9 * 60], '2026-07-15T07:00:00.000Z'],
    ['the morning after the clock went forward', ['2026-03-29', 9 * 60], '2026-03-29T07:00:00.000Z'],
    ['the night before the clock goes forward', ['2026-03-29', 60], '2026-03-29T00:00:00.000Z'],
    ['a time the clock skips, read after the jump', ['2026-03-29', 2 * 60 + 30], '2026-03-29T01:30:00.000Z'],
    ['a time the clock shows twice, read the first time', ['2026-10-25', 2 * 60 + 30], '2026-10-25T00:30:00.000Z'],
    ['the morning after the clock went back', ['2026-10-25', 9 * 60], '2026-10-25T08:00:00.000Z'],
    ['the end of a day', ['2026-01-15', 24 * 60], '2026-01-15T23:00:00.000Z'],
  ] as const)('finds the instant of %s', (_case, [day, minute], instant) => {
    expect(paris.instantAt(day, minute)).toEqual(new Date(instant));
  });

  it.each([
    ['2026-02-28', true],
    ['2028-02-29', true],
    ['2026-02-29', false],
    ['2026-13-01', false],
    ['26-01-01', false],
    ['tomorrow', false],
  ])('says whether %s is a day', (day, expected) => {
    expect(TimeZone.isDay(day)).toBe(expected);
  });
});

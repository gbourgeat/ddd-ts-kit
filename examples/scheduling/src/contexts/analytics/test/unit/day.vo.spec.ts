import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { Day } from '../../domain/value-objects/day.vo.js';

describe('Day', () => {
  it('is equal to another day with the same value', () => {
    const first = unwrap(Day.create('2026-10-12'));
    const second = unwrap(Day.create('2026-10-12'));

    expect(first.equals(second)).toBe(true);
  });

  it('refuses an empty value with a coded error', () => {
    const result = Day.create('  ');

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_DAY' } });
  });

  it('accepts a calendar date written year, month, day, a leap day included', () => {
    expect(unwrap(Day.create('2028-02-29')).value).toBe('2028-02-29');
  });

  it.each(['12/10/2026', '2026-10-12T08:00:00Z', '2026-13-01', '2026-02-30'])('refuses %s, which is not a calendar date', (value) => {
    expect(Day.create(value)).toMatchObject({ ok: false, error: { code: 'INVALID_DAY' } });
  });

  it('reads a date surrounded by spaces as the same day', () => {
    expect(unwrap(Day.create(' 2026-10-12 ')).equals(unwrap(Day.create('2026-10-12')))).toBe(true);
  });

  it('is the calendar date of an instant, read in UTC', () => {
    expect(Day.containing(new Date('2026-10-12T01:00:00.000Z')).value).toBe('2026-10-12');
  });

  it('counts days back across a month and a change of clocks', () => {
    expect(unwrap(Day.create('2026-11-02')).minus(7).value).toBe('2026-10-26');
  });
});

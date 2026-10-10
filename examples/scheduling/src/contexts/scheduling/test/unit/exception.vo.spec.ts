import { describe, expect, it } from 'vitest';
import { unwrap } from '@ddd-ts-kit/kernel';
import { InvalidDayError } from '../../domain/errors/invalid-day.error.js';
import { InvalidRangeError } from '../../domain/errors/invalid-range.error.js';
import { Exception } from '../../domain/value-objects/exception.vo.js';
import { Range } from '../../domain/value-objects/range.vo.js';

describe('Exception', () => {
  it('is equal to another exception of the same day with the same ranges', () => {
    const first = unwrap(Exception.create('2026-05-01', [range('14:00', '16:00'), range('09:00', '10:00')]));

    expect(first.equals(unwrap(Exception.create('2026-05-01', [range('09:00', '10:00'), range('14:00', '16:00')])))).toBe(true);
    expect(first.equals(unwrap(Exception.create('2026-05-01', [])))).toBe(false);
  });

  it('closes its day when it has no range', () => {
    const closed = unwrap(Exception.create('2026-05-01', []));

    expect(closed.ranges).toEqual([]);
    expect(closed.isOn('2026-05-01')).toBe(true);
    expect(closed.isOn('2026-05-02')).toBe(false);
  });

  it.each(['2026-02-30', '01/05/2026', ''])('refuses %j, which is not a day', (day) => {
    expect(Exception.create(day, [])).toMatchObject({ ok: false, error: expect.any(InvalidDayError) });
  });

  it('refuses ranges that share a minute', () => {
    const result = Exception.create('2026-05-01', [range('09:00', '12:00'), range('11:00', '13:00')]);

    expect(result).toMatchObject({ ok: false, error: expect.any(InvalidRangeError) });
  });
});

function range(start: string, end: string): Range {
  return unwrap(Range.create(start, end));
}

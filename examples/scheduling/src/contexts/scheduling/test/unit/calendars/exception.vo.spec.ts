import { describe, expect, it } from 'vitest';
import { Exception } from '@/contexts/scheduling/calendars/domain/value-objects/exception.vo';
import { Range } from '@/contexts/scheduling/calendars/domain/value-objects/range.vo';
import { expectRefusal } from '@ddd-ts-kit/testing';

describe('Exception', () => {
  it('is equal to another exception of the same day with the same ranges', () => {
    const first = Exception.create('2026-05-01', [range('14:00', '16:00'), range('09:00', '10:00')]);

    expect(first.equals(Exception.create('2026-05-01', [range('09:00', '10:00'), range('14:00', '16:00')]))).toBe(true);

    expect(first.equals(Exception.create('2026-05-01', []))).toBe(false);
  });

  it('closes its day when it has no range', () => {
    const closed = Exception.create('2026-05-01', []);

    expect(closed.ranges).toEqual([]);
    expect(closed.isOn('2026-05-01')).toBe(true);
    expect(closed.isOn('2026-05-02')).toBe(false);
  });

  it.each(['2026-02-30', '01/05/2026', ''])('refuses %j, which is not a day', (day) => {
    expectRefusal(() => Exception.create(day, []), 'INVALID_DAY');
  });

  it('refuses ranges that share a minute', () => {
    expectRefusal(
      () => Exception.create('2026-05-01', [range('09:00', '12:00'), range('11:00', '13:00')]),
      'INVALID_RANGE',
    );
  });
});

function range(start: string, end: string): Range {
  return Range.create(start, end);
}

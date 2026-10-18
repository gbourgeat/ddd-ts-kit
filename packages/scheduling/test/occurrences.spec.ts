import { describe, expect, it } from 'vitest';
import { parseJobSchedule, type JobSchedule } from '@ddd-ts-kit/kernel';
import { latestOccurrence, nextOccurrence } from '../src/index.js';

/** The occurrences that follow an instant, as ISO texts. */
function following(schedule: JobSchedule, after: string, count: number): string[] {
  const parsed = parseJobSchedule(schedule);
  const found: string[] = [];

  for (let cursor = new Date(after); found.length < count; ) {
    cursor = nextOccurrence(parsed, cursor);
    found.push(cursor.toISOString());
  }

  return found;
}

function latest(schedule: JobSchedule, after: string, notAfter: string): string | undefined {
  return latestOccurrence(parseJobSchedule(schedule), {
    after: new Date(after),
    notAfter: new Date(notAfter),
  })?.toISOString();
}

describe('an interval', () => {
  it('falls on the multiples of its length since the epoch, whatever the instant it is asked from', () => {
    expect(following({ every: '15m' }, '2026-03-02T09:58:30.000Z', 3)).toEqual([
      '2026-03-02T10:00:00.000Z',
      '2026-03-02T10:15:00.000Z',
      '2026-03-02T10:30:00.000Z',
    ]);

    expect(following({ every: '1d' }, '2026-03-02T09:58:30.000Z', 1)).toEqual(['2026-03-03T00:00:00.000Z']);

    expect(following({ every: 90_000 }, '2026-03-02T10:00:00.000Z', 2)).toEqual([
      '2026-03-02T10:01:30.000Z',
      '2026-03-02T10:03:00.000Z',
    ]);
  });

  it('is strictly after the instant: an occurrence is not its own successor', () => {
    expect(following({ every: '2h' }, '2026-03-02T10:00:00.000Z', 1)).toEqual(['2026-03-02T12:00:00.000Z']);
  });

  it('names the latest occurrence of a range, the start excluded and the end included', () => {
    expect(latest({ every: '15m' }, '2026-03-02T10:00:00.000Z', '2026-03-02T10:50:00.000Z')).toBe(
      '2026-03-02T10:45:00.000Z',
    );

    expect(latest({ every: '15m' }, '2026-03-02T10:00:00.000Z', '2026-03-02T10:15:00.000Z')).toBe(
      '2026-03-02T10:15:00.000Z',
    );

    expect(latest({ every: '15m' }, '2026-03-02T10:00:00.000Z', '2026-03-02T10:14:59.999Z')).toBeUndefined();
  });
});

describe('a cron expression in UTC', () => {
  it('reads minutes, hours, lists, ranges and steps', () => {
    expect(following({ cron: '*/20 8-9 * * *' }, '2026-03-02T08:10:00.000Z', 6)).toEqual([
      '2026-03-02T08:20:00.000Z',
      '2026-03-02T08:40:00.000Z',
      '2026-03-02T09:00:00.000Z',
      '2026-03-02T09:20:00.000Z',
      '2026-03-02T09:40:00.000Z',
      '2026-03-03T08:00:00.000Z',
    ]);

    expect(following({ cron: '5,35 0 * * *' }, '2026-03-02T00:05:00.000Z', 2)).toEqual([
      '2026-03-02T00:35:00.000Z',
      '2026-03-03T00:05:00.000Z',
    ]);

    expect(following({ cron: '0 10-20/5 * * *' }, '2026-03-02T00:00:00.000Z', 4)).toEqual([
      '2026-03-02T10:00:00.000Z',
      '2026-03-02T15:00:00.000Z',
      '2026-03-02T20:00:00.000Z',
      '2026-03-03T10:00:00.000Z',
    ]);
  });

  it('reads the names of months and days, and both 0 and 7 as Sunday', () => {
    expect(following({ cron: '0 7 * * mon-fri' }, '2026-03-06T08:00:00.000Z', 2)).toEqual([
      '2026-03-09T07:00:00.000Z',
      '2026-03-10T07:00:00.000Z',
    ]);

    expect(following({ cron: '0 0 1 JAN,jul *' }, '2026-03-02T00:00:00.000Z', 2)).toEqual([
      '2026-07-01T00:00:00.000Z',
      '2027-01-01T00:00:00.000Z',
    ]);

    expect(following({ cron: '0 0 * * 7' }, '2026-03-02T00:00:00.000Z', 1)).toEqual(
      following({ cron: '0 0 * * 0' }, '2026-03-02T00:00:00.000Z', 1),
    );

    expect(following({ cron: '0 0 * * sun' }, '2026-03-02T00:00:00.000Z', 1)).toEqual(['2026-03-08T00:00:00.000Z']);

    expect(following({ cron: '0 0 * * 5-7' }, '2026-03-02T00:00:00.000Z', 3)).toEqual([
      '2026-03-06T00:00:00.000Z',
      '2026-03-07T00:00:00.000Z',
      '2026-03-08T00:00:00.000Z',
    ]);
  });

  it('takes a day that fits either day field when both are restricted', () => {
    // The 13th, and every Friday: March 2026 has Fridays on the 6th, 13th, 20th.
    expect(following({ cron: '0 0 13 * fri' }, '2026-03-01T00:00:00.000Z', 4)).toEqual([
      '2026-03-06T00:00:00.000Z',
      '2026-03-13T00:00:00.000Z',
      '2026-03-20T00:00:00.000Z',
      '2026-03-27T00:00:00.000Z',
    ]);

    expect(following({ cron: '0 0 13 * fri' }, '2026-04-10T00:00:00.000Z', 2)).toEqual([
      '2026-04-13T00:00:00.000Z',
      '2026-04-17T00:00:00.000Z',
    ]);
  });

  it('takes a day that fits both day fields when one of them starts with a star', () => {
    // Every second day of the month that is also a Monday.
    expect(following({ cron: '0 0 */2 * mon' }, '2026-03-01T00:00:00.000Z', 3)).toEqual([
      '2026-03-09T00:00:00.000Z',
      '2026-03-23T00:00:00.000Z',
      '2026-04-13T00:00:00.000Z',
    ]);
  });

  it('waits years for a date that is rare: the 29th of February', () => {
    expect(following({ cron: '0 0 29 2 *' }, '2026-03-02T00:00:00.000Z', 2)).toEqual([
      '2028-02-29T00:00:00.000Z',
      '2032-02-29T00:00:00.000Z',
    ]);

    expect(following({ cron: '0 0 29 2 *' }, '2096-03-01T00:00:00.000Z', 1)).toEqual(['2104-02-29T00:00:00.000Z']);
  });

  it('names the latest occurrence of a range', () => {
    expect(latest({ cron: '0 7 * * 1-5' }, '2026-03-06T07:00:00.000Z', '2026-03-10T06:59:00.000Z')).toBe(
      '2026-03-09T07:00:00.000Z',
    );

    expect(latest({ cron: '0 7 * * 1-5' }, '2026-03-06T07:00:00.000Z', '2026-03-09T06:59:00.000Z')).toBeUndefined();

    expect(latest({ cron: '0 0 29 2 *' }, '2020-01-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z')).toBe(
      '2024-02-29T00:00:00.000Z',
    );
  });
});

describe('a cron expression in a time zone', () => {
  it('follows the clocks of the zone, summer and winter', () => {
    const weekdaysAtSeven: JobSchedule = { cron: '0 7 * * 1-5', timeZone: 'Europe/Paris' };

    expect(following(weekdaysAtSeven, '2026-01-15T12:00:00.000Z', 1)).toEqual(['2026-01-16T06:00:00.000Z']);
    expect(following(weekdaysAtSeven, '2026-07-15T12:00:00.000Z', 1)).toEqual(['2026-07-16T05:00:00.000Z']);
  });

  it('reads the day in the zone, not in UTC', () => {
    // Monday 00:30 in Paris is still Sunday in UTC.
    expect(following({ cron: '30 0 * * mon', timeZone: 'Europe/Paris' }, '2026-03-06T00:00:00.000Z', 1)).toEqual([
      '2026-03-08T23:30:00.000Z',
    ]);

    expect(following({ cron: '0 20 * * fri', timeZone: 'Pacific/Auckland' }, '2026-03-02T00:00:00.000Z', 1)).toEqual([
      '2026-03-06T07:00:00.000Z',
    ]);

    expect(following({ cron: '15 9 * * *', timeZone: 'Asia/Kolkata' }, '2026-03-02T00:00:00.000Z', 1)).toEqual([
      '2026-03-02T03:45:00.000Z',
    ]);
  });

  it('reads a shorthand as its five fields: @daily is midnight on the clocks of the zone', () => {
    expect(following({ cron: '@daily', timeZone: 'Europe/Paris' }, '2026-03-27T12:00:00.000Z', 3)).toEqual([
      '2026-03-27T23:00:00.000Z',
      '2026-03-28T23:00:00.000Z',
      '2026-03-29T22:00:00.000Z',
    ]);

    expect(following({ cron: '@hourly', timeZone: 'Europe/Paris' }, '2026-03-28T23:30:00.000Z', 3)).toEqual(
      following({ cron: '0 * * * *', timeZone: 'Europe/Paris' }, '2026-03-28T23:30:00.000Z', 3),
    );
  });

  it('follows a zone whose change is half an hour: Lord Howe Island', () => {
    // 2026-04-05: at 02:00 the clocks go back to 01:30, so 01:45 occurs twice.
    expect(following({ cron: '45 1 * * *', timeZone: 'Australia/Lord_Howe' }, '2026-04-03T12:00:00.000Z', 3)).toEqual([
      '2026-04-03T14:45:00.000Z',
      '2026-04-04T14:45:00.000Z',
      '2026-04-05T15:15:00.000Z',
    ]);
  });
});

describe('a cron expression in a time zone, when clocks are set forward', () => {
  it('skips a local time that does not exist: 02:30 in Paris on 2026-03-29', () => {
    expect(following({ cron: '30 2 * * *', timeZone: 'Europe/Paris' }, '2026-03-27T12:00:00.000Z', 3)).toEqual([
      '2026-03-28T01:30:00.000Z',
      '2026-03-30T00:30:00.000Z',
      '2026-03-31T00:30:00.000Z',
    ]);
  });

  it('skips 02:30 in New York on 2026-03-08, and keeps 03:00 which exists', () => {
    expect(following({ cron: '30 2 * * *', timeZone: 'America/New_York' }, '2026-03-06T12:00:00.000Z', 2)).toEqual([
      '2026-03-07T07:30:00.000Z',
      '2026-03-09T06:30:00.000Z',
    ]);

    expect(following({ cron: '0 3 * * *', timeZone: 'America/New_York' }, '2026-03-07T12:00:00.000Z', 1)).toEqual([
      '2026-03-08T07:00:00.000Z',
    ]);
  });

  it('keeps the rhythm of a job of every hour: 01:00 then 03:00 on the clocks, one hour apart', () => {
    expect(following({ cron: '0 * * * *', timeZone: 'Europe/Paris' }, '2026-03-28T23:30:00.000Z', 3)).toEqual([
      '2026-03-29T00:00:00.000Z',
      '2026-03-29T01:00:00.000Z',
      '2026-03-29T02:00:00.000Z',
    ]);
  });
});

describe('a cron expression in a time zone, when clocks are set back', () => {
  it('runs once a local time that occurs twice: 02:30 in Paris on 2026-10-25, the first time', () => {
    expect(following({ cron: '30 2 * * *', timeZone: 'Europe/Paris' }, '2026-10-24T12:00:00.000Z', 2)).toEqual([
      '2026-10-25T00:30:00.000Z',
      '2026-10-26T01:30:00.000Z',
    ]);
  });

  it('runs once 01:30 in New York on 2026-11-01, even when asked between its two passages', () => {
    const nightly: JobSchedule = { cron: '30 1 * * *', timeZone: 'America/New_York' };

    expect(following(nightly, '2026-10-31T12:00:00.000Z', 2)).toEqual([
      '2026-11-01T05:30:00.000Z',
      '2026-11-02T06:30:00.000Z',
    ]);

    expect(following(nightly, '2026-11-01T06:00:00.000Z', 1)).toEqual(['2026-11-02T06:30:00.000Z']);
  });

  it('runs once per local minute a job pinned to the repeated hour', () => {
    const everyQuarterOfTwo: JobSchedule = { cron: '*/15 2 * * *', timeZone: 'Europe/Paris' };

    expect(following(everyQuarterOfTwo, '2026-10-24T12:00:00.000Z', 5)).toEqual([
      '2026-10-25T00:00:00.000Z',
      '2026-10-25T00:15:00.000Z',
      '2026-10-25T00:30:00.000Z',
      '2026-10-25T00:45:00.000Z',
      '2026-10-26T01:00:00.000Z',
    ]);
  });

  it('keeps the rhythm of a job of every hour or every few minutes: the repeated hour is run through twice', () => {
    expect(following({ cron: '0 * * * *', timeZone: 'Europe/Paris' }, '2026-10-24T22:30:00.000Z', 4)).toEqual([
      '2026-10-24T23:00:00.000Z',
      '2026-10-25T00:00:00.000Z',
      '2026-10-25T01:00:00.000Z',
      '2026-10-25T02:00:00.000Z',
    ]);

    expect(following({ cron: '*/30 * * * *', timeZone: 'America/New_York' }, '2026-11-01T05:00:00.000Z', 4)).toEqual([
      '2026-11-01T05:30:00.000Z',
      '2026-11-01T06:00:00.000Z',
      '2026-11-01T06:30:00.000Z',
      '2026-11-01T07:00:00.000Z',
    ]);
  });

  it('names the latest occurrence across the change', () => {
    expect(
      latest({ cron: '30 2 * * *', timeZone: 'Europe/Paris' }, '2026-10-24T12:00:00.000Z', '2026-10-25T12:00:00.000Z'),
    ).toBe('2026-10-25T00:30:00.000Z');

    expect(
      latest({ cron: '0 * * * *', timeZone: 'Europe/Paris' }, '2026-10-24T12:00:00.000Z', '2026-10-25T01:10:00.000Z'),
    ).toBe('2026-10-25T01:00:00.000Z');
  });
});

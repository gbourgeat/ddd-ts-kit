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
  return latestOccurrence(parseJobSchedule(schedule), { after: new Date(after), notAfter: new Date(notAfter) })?.toISOString();
}

describe('an interval', () => {
  it('falls on the multiples of its length since the epoch, whatever the instant it is asked from', () => {
    expect(following({ every: '15m' }, '2026-03-02T09:58:30.000Z', 3)).toEqual([
      '2026-03-02T10:00:00.000Z',
      '2026-03-02T10:15:00.000Z',
      '2026-03-02T10:30:00.000Z',
    ]);
    expect(following({ every: '1d' }, '2026-03-02T09:58:30.000Z', 1)).toEqual(['2026-03-03T00:00:00.000Z']);
    expect(following({ every: 90_000 }, '2026-03-02T10:00:00.000Z', 2)).toEqual(['2026-03-02T10:01:30.000Z', '2026-03-02T10:03:00.000Z']);
  });

  it('is strictly after the instant: an occurrence is not its own successor', () => {
    expect(following({ every: '2h' }, '2026-03-02T10:00:00.000Z', 1)).toEqual(['2026-03-02T12:00:00.000Z']);
  });

  it('names the latest occurrence of a range, the start excluded and the end included', () => {
    expect(latest({ every: '15m' }, '2026-03-02T10:00:00.000Z', '2026-03-02T10:50:00.000Z')).toBe('2026-03-02T10:45:00.000Z');
    expect(latest({ every: '15m' }, '2026-03-02T10:00:00.000Z', '2026-03-02T10:15:00.000Z')).toBe('2026-03-02T10:15:00.000Z');
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
    expect(following({ cron: '5,35 0 * * *' }, '2026-03-02T00:05:00.000Z', 2)).toEqual(['2026-03-02T00:35:00.000Z', '2026-03-03T00:05:00.000Z']);
    expect(following({ cron: '0 10-20/5 * * *' }, '2026-03-02T00:00:00.000Z', 4)).toEqual([
      '2026-03-02T10:00:00.000Z',
      '2026-03-02T15:00:00.000Z',
      '2026-03-02T20:00:00.000Z',
      '2026-03-03T10:00:00.000Z',
    ]);
  });

  it('reads the names of months and days, and both 0 and 7 as Sunday', () => {
    expect(following({ cron: '0 7 * * mon-fri' }, '2026-03-06T08:00:00.000Z', 2)).toEqual(['2026-03-09T07:00:00.000Z', '2026-03-10T07:00:00.000Z']);
    expect(following({ cron: '0 0 1 JAN,jul *' }, '2026-03-02T00:00:00.000Z', 2)).toEqual(['2026-07-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z']);
    expect(following({ cron: '0 0 * * 7' }, '2026-03-02T00:00:00.000Z', 1)).toEqual(following({ cron: '0 0 * * 0' }, '2026-03-02T00:00:00.000Z', 1));
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
    expect(following({ cron: '0 0 13 * fri' }, '2026-04-10T00:00:00.000Z', 2)).toEqual(['2026-04-13T00:00:00.000Z', '2026-04-17T00:00:00.000Z']);
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
    expect(following({ cron: '0 0 29 2 *' }, '2026-03-02T00:00:00.000Z', 2)).toEqual(['2028-02-29T00:00:00.000Z', '2032-02-29T00:00:00.000Z']);
    expect(following({ cron: '0 0 29 2 *' }, '2096-03-01T00:00:00.000Z', 1)).toEqual(['2104-02-29T00:00:00.000Z']);
  });

  it('names the latest occurrence of a range', () => {
    expect(latest({ cron: '0 7 * * 1-5' }, '2026-03-06T07:00:00.000Z', '2026-03-10T06:59:00.000Z')).toBe('2026-03-09T07:00:00.000Z');
    expect(latest({ cron: '0 7 * * 1-5' }, '2026-03-06T07:00:00.000Z', '2026-03-09T06:59:00.000Z')).toBeUndefined();
    expect(latest({ cron: '0 0 29 2 *' }, '2020-01-01T00:00:00.000Z', '2026-03-02T00:00:00.000Z')).toBe('2024-02-29T00:00:00.000Z');
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
    expect(following({ cron: '30 0 * * mon', timeZone: 'Europe/Paris' }, '2026-03-06T00:00:00.000Z', 1)).toEqual(['2026-03-08T23:30:00.000Z']);
    expect(following({ cron: '0 20 * * fri', timeZone: 'Pacific/Auckland' }, '2026-03-02T00:00:00.000Z', 1)).toEqual(['2026-03-06T07:00:00.000Z']);
    expect(following({ cron: '15 9 * * *', timeZone: 'Asia/Kolkata' }, '2026-03-02T00:00:00.000Z', 1)).toEqual(['2026-03-02T03:45:00.000Z']);
  });

  describe('when clocks are set forward', () => {
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
      expect(following({ cron: '0 3 * * *', timeZone: 'America/New_York' }, '2026-03-07T12:00:00.000Z', 1)).toEqual(['2026-03-08T07:00:00.000Z']);
    });

    it('keeps the rhythm of a job of every hour: 01:00 then 03:00 on the clocks, one hour apart', () => {
      expect(following({ cron: '0 * * * *', timeZone: 'Europe/Paris' }, '2026-03-28T23:30:00.000Z', 3)).toEqual([
        '2026-03-29T00:00:00.000Z',
        '2026-03-29T01:00:00.000Z',
        '2026-03-29T02:00:00.000Z',
      ]);
    });
  });

  describe('when clocks are set back', () => {
    it('runs once a local time that occurs twice: 02:30 in Paris on 2026-10-25, the first time', () => {
      expect(following({ cron: '30 2 * * *', timeZone: 'Europe/Paris' }, '2026-10-24T12:00:00.000Z', 2)).toEqual([
        '2026-10-25T00:30:00.000Z',
        '2026-10-26T01:30:00.000Z',
      ]);
    });

    it('runs once 01:30 in New York on 2026-11-01, even when asked between its two passages', () => {
      const nightly: JobSchedule = { cron: '30 1 * * *', timeZone: 'America/New_York' };

      expect(following(nightly, '2026-10-31T12:00:00.000Z', 2)).toEqual(['2026-11-01T05:30:00.000Z', '2026-11-02T06:30:00.000Z']);
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
      expect(latest({ cron: '30 2 * * *', timeZone: 'Europe/Paris' }, '2026-10-24T12:00:00.000Z', '2026-10-25T12:00:00.000Z')).toBe('2026-10-25T00:30:00.000Z');
      expect(latest({ cron: '0 * * * *', timeZone: 'Europe/Paris' }, '2026-10-24T12:00:00.000Z', '2026-10-25T01:10:00.000Z')).toBe('2026-10-25T01:00:00.000Z');
    });
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

/*
 * The reference: every minute of a window, one by one, each asked to Intl for the wall time it
 * shows. Slow and obvious, where the implementation jumps from day to day.
 */
interface Reference {
  readonly minute: readonly number[];
  readonly hour: readonly number[];
  readonly matchesDay: (dayOfMonth: number, month: number, dayOfWeek: number) => boolean;
  readonly everyHour: boolean;
}

interface WallTime {
  readonly instant: number;
  readonly key: string;
  readonly fields: readonly number[];
  readonly dayOfWeek: number;
  /** True when the clocks already showed this minute earlier in the window. */
  readonly repeated: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FIELDS: readonly Intl.DateTimeFormatPartTypes[] = ['year', 'month', 'day', 'hour', 'minute'];
const windows = new Map<string, WallTime[]>();

/** Every minute of the window with the wall time the zone shows, computed once for all the expressions. */
function minutesOf(timeZone: string, window: { from: number; minutes: number }): WallTime[] {
  const known = windows.get(`${timeZone}@${window.from}`);
  if (known !== undefined) return known;
  const format = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' });
  const seen = new Set<string>();
  const minutes = Array.from({ length: window.minutes }, (_, step): WallTime => {
    const instant = window.from + step * 60_000;
    const parts = new Map(format.formatToParts(instant).map((part) => [part.type, part.value]));
    const fields = FIELDS.map((type) => Number(parts.get(type)));
    const key = fields.join('-');
    const repeated = seen.has(key);
    seen.add(key);
    return { instant, key, fields, dayOfWeek: DAYS.indexOf(parts.get('weekday') ?? ''), repeated };
  });
  windows.set(`${timeZone}@${window.from}`, minutes);
  return minutes;
}

function referenceOccurrences(reference: Reference, timeZone: string, window: { from: number; minutes: number }): number[] {
  return minutesOf(timeZone, window)
    .filter(({ fields: [, month = 0, day = 0, hour = 0, minute = 0], dayOfWeek, repeated }) => {
      if (!reference.minute.includes(minute) || !reference.hour.includes(hour) || !reference.matchesDay(day, month, dayOfWeek)) return false;
      return !repeated || reference.everyHour;
    })
    .map(({ instant }) => instant);
}

const range = (from: number, to: number, step = 1): number[] => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, index) => from + index * step);

const CASES: readonly { readonly cron: string; readonly reference: Reference }[] = [
  { cron: '30 2 * * *', reference: { minute: [30], hour: [2], matchesDay: () => true, everyHour: false } },
  { cron: '*/15 1-3 * * *', reference: { minute: [0, 15, 30, 45], hour: [1, 2, 3], matchesDay: () => true, everyHour: false } },
  { cron: '7 * * * *', reference: { minute: [7], hour: range(0, 23), matchesDay: () => true, everyHour: true } },
  { cron: '*/20 */3 * * *', reference: { minute: [0, 20, 40], hour: range(0, 23, 3), matchesDay: () => true, everyHour: true } },
  { cron: '0 0,12 * * sat,sun', reference: { minute: [0], hour: [0, 12], matchesDay: (_day, _month, dayOfWeek) => dayOfWeek === 0 || dayOfWeek === 6, everyHour: false } },
  { cron: '45 1 25-31 3,10 0', reference: { minute: [45], hour: [1], matchesDay: (day, month, dayOfWeek) => [3, 10].includes(month) && (day >= 25 || dayOfWeek === 0), everyHour: false } },
];
const ZONES = ['Europe/Paris', 'America/New_York', 'Australia/Lord_Howe', 'America/Sao_Paulo', 'Asia/Kolkata', 'UTC'];
/** Six days around each change of offset of 2026 in Paris, New York and Lord Howe, and an ordinary week. */
const WINDOWS = ['2026-03-06', '2026-03-27', '2026-04-03', '2026-10-02', '2026-10-23', '2026-10-30', '2026-06-10'].map((day) => ({
  from: Date.parse(`${day}T00:00:00.000Z`),
  minutes: 6 * 24 * 60,
}));

describe('the next occurrence of a cron expression, against every minute asked to Intl', () => {
  for (const { cron, reference } of CASES) {
    it(`"${cron}" in ${ZONES.length} zones, over ${WINDOWS.length} windows`, () => {
      for (const timeZone of ZONES) {
        const parsed = parseJobSchedule({ cron, timeZone });
        for (const window of WINDOWS) {
          const expected = referenceOccurrences(reference, timeZone, window);
          const end = window.from + window.minutes * 60_000;
          const found: number[] = [];
          for (let cursor = nextOccurrence(parsed, new Date(window.from - 1)); cursor.getTime() < end; cursor = nextOccurrence(parsed, cursor)) {
            found.push(cursor.getTime());
          }

          expect(found.map((instant) => new Date(instant).toISOString()), `${cron} in ${timeZone}`).toEqual(expected.map((instant) => new Date(instant).toISOString()));
        }
      }
    });
  }

  it('answers the same from any instant between two occurrences, and the latest occurrence is its mirror', () => {
    const parsed = parseJobSchedule({ cron: '*/15 1-3 * * *', timeZone: 'Europe/Paris' });
    const from = Date.parse('2026-10-24T20:00:00.000Z');
    let seed = 20261025;
    for (let sample = 0; sample < 400; sample += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const instant = new Date(from + (seed % (36 * 3_600_000)));
      const next = nextOccurrence(parsed, instant);
      const previous = latestOccurrence(parsed, { after: new Date(from - 86_400_000), notAfter: instant });

      expect(next.getTime()).toBeGreaterThan(instant.getTime());
      expect(nextOccurrence(parsed, new Date(next.getTime() - 1)).getTime()).toBe(next.getTime());
      expect(previous).toBeDefined();
      expect(nextOccurrence(parsed, previous ?? instant).getTime()).toBe(next.getTime());
    }
  });
});

import { describe, expect, it } from 'vitest';
import { parseJobSchedule } from '@ddd-ts-kit/kernel';
import { latestOccurrence, nextOccurrence } from '../src/index.js';

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

  if (known !== undefined) {
    return known;
  }

  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
  });

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

function referenceOccurrences(
  reference: Reference,
  timeZone: string,
  window: { from: number; minutes: number },
): number[] {
  return minutesOf(timeZone, window)
    .filter(({ fields: [, month = 0, day = 0, hour = 0, minute = 0], dayOfWeek, repeated }) => {
      if (
        !reference.minute.includes(minute) ||
        !reference.hour.includes(hour) ||
        !reference.matchesDay(day, month, dayOfWeek)
      ) {
        return false;
      }

      return !repeated || reference.everyHour;
    })
    .map(({ instant }) => instant);
}

const range = (from: number, to: number, step = 1): number[] =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, index) => from + index * step);

const CASES: readonly { readonly cron: string; readonly reference: Reference }[] = [
  { cron: '30 2 * * *', reference: { minute: [30], hour: [2], matchesDay: () => true, everyHour: false } },
  {
    cron: '*/15 1-3 * * *',
    reference: { minute: [0, 15, 30, 45], hour: [1, 2, 3], matchesDay: () => true, everyHour: false },
  },
  { cron: '7 * * * *', reference: { minute: [7], hour: range(0, 23), matchesDay: () => true, everyHour: true } },
  {
    cron: '*/20 */3 * * *',
    reference: { minute: [0, 20, 40], hour: range(0, 23, 3), matchesDay: () => true, everyHour: true },
  },
  {
    cron: '0 0,12 * * sat,sun',
    reference: {
      minute: [0],
      hour: [0, 12],
      matchesDay: (_day, _month, dayOfWeek) => dayOfWeek === 0 || dayOfWeek === 6,
      everyHour: false,
    },
  },
  {
    cron: '45 1 25-31 3,10 0',
    reference: {
      minute: [45],
      hour: [1],
      matchesDay: (day, month, dayOfWeek) => [3, 10].includes(month) && (day >= 25 || dayOfWeek === 0),
      everyHour: false,
    },
  },
];

const ZONES = ['Europe/Paris', 'America/New_York', 'Australia/Lord_Howe', 'America/Sao_Paulo', 'Asia/Kolkata', 'UTC'];

/** Six days around each change of offset of 2026 in Paris, New York and Lord Howe, and an ordinary week. */
const WINDOWS = ['2026-03-06', '2026-03-27', '2026-04-03', '2026-10-02', '2026-10-23', '2026-10-30', '2026-06-10'].map(
  (day) => ({
    from: Date.parse(`${day}T00:00:00.000Z`),
    minutes: 6 * 24 * 60,
  }),
);

describe('the next occurrence of a cron expression, against every minute asked to Intl', () => {
  for (const { cron, reference } of CASES) {
    it(`"${cron}" in ${ZONES.length} zones, over ${WINDOWS.length} windows`, () => {
      for (const timeZone of ZONES) {
        const parsed = parseJobSchedule({ cron, timeZone });

        for (const window of WINDOWS) {
          const expected = referenceOccurrences(reference, timeZone, window);
          const end = window.from + window.minutes * 60_000;
          const found: number[] = [];

          for (
            let cursor = nextOccurrence(parsed, new Date(window.from - 1));
            cursor.getTime() < end;
            cursor = nextOccurrence(parsed, cursor)
          ) {
            found.push(cursor.getTime());
          }

          expect(
            found.map((instant) => new Date(instant).toISOString()),
            `${cron} in ${timeZone}`,
          ).toEqual(expected.map((instant) => new Date(instant).toISOString()));
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

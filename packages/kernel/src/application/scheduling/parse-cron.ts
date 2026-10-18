import { InvalidJobScheduleError } from './invalid-job-schedule-error.js';
import type { ParsedCron } from './parsed-job-schedule.js';

interface CronField {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly names: readonly string[];
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const MINUTE: CronField = { label: 'minute', min: 0, max: 59, names: [] };

const HOUR: CronField = { label: 'hour', min: 0, max: 23, names: [] };

const DAY_OF_MONTH: CronField = { label: 'day of month', min: 1, max: 31, names: [] };

const MONTH: CronField = { label: 'month', min: 1, max: 12, names: MONTH_NAMES };

const DAY_OF_WEEK: CronField = { label: 'day of week', min: 0, max: 7, names: DAY_NAMES };

/** The shorthands most cron implementations accept, each one a fixed set of five fields. `@reboot` is not one: a scheduled job has no occurrence at start. */
const SHORTHANDS = new Map([
  ['@yearly', '0 0 1 1 *'],
  ['@annually', '0 0 1 1 *'],
  ['@monthly', '0 0 1 * *'],
  ['@weekly', '0 0 * * 0'],
  ['@daily', '0 0 * * *'],
  ['@midnight', '0 0 * * *'],
  ['@hourly', '0 * * * *'],
]);

export function parseCron(expression: string, timeZone: string): ParsedCron {
  const written = expression.trim();
  const fields = fieldsOf(written);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;

  if (
    fields.length !== 5 ||
    minute === undefined ||
    hour === undefined ||
    dayOfMonth === undefined ||
    month === undefined ||
    dayOfWeek === undefined
  ) {
    throw new InvalidJobScheduleError(
      `Cron "${expression}" has ${fields.length} field(s): five are expected (minute, hour, day of month, month, day of week).`,
    );
  }

  assertTimeZone(timeZone);

  return firing({
    kind: 'cron',
    expression: written.startsWith('@') ? written : fields.join(' '),
    timeZone,
    minutes: valuesOf(minute, MINUTE),
    hours: valuesOf(hour, HOUR),
    daysOfMonth: valuesOf(dayOfMonth, DAY_OF_MONTH),
    months: valuesOf(month, MONTH),
    daysOfWeek: unique(valuesOf(dayOfWeek, DAY_OF_WEEK).map((day) => day % 7)),
    dayOfMonthRestricted: !dayOfMonth.startsWith('*'),
    dayOfWeekRestricted: !dayOfWeek.startsWith('*'),
    everyHour: hour.startsWith('*'),
  });
}

/** The fields of an expression, a shorthand replaced by the five it stands for. */
function fieldsOf(written: string): string[] {
  if (!written.startsWith('@')) {
    return written.split(/\s+/);
  }

  const expanded = SHORTHANDS.get(written.toLowerCase());

  if (expanded === undefined) {
    throw new InvalidJobScheduleError(
      `Cron "${written}" is not a shorthand a scheduled job runs on: write five fields or one of ${[...SHORTHANDS.keys()].join(', ')}.`,
    );
  }

  return expanded.split(' ');
}

function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new InvalidJobScheduleError(
      `"${timeZone}" is not a time zone this runtime knows: write an IANA name such as 'Europe/Paris'.`,
    );
  }
}

const LONGEST_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Refuses the expression no date satisfies, such as the 31st of February. */
function firing(cron: ParsedCron): ParsedCron {
  if (!cron.dayOfMonthRestricted || cron.dayOfWeekRestricted) {
    return cron;
  }

  const earliestDay = cron.daysOfMonth[0] ?? 1;

  if (cron.months.some((month) => earliestDay <= (LONGEST_MONTH[month - 1] ?? 0))) {
    return cron;
  }

  throw new InvalidJobScheduleError(`Cron "${cron.expression}" never fires: none of its months has such a day.`);
}

function valuesOf(text: string, field: CronField): number[] {
  return unique(text.split(',').flatMap((part) => partValues(part, field)));
}

function unique(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

const EVERY_VALUE = /^\*(?:\/(\d+))?$/;

const VALUE_OR_RANGE = /^([a-z0-9]+)(?:-([a-z0-9]+)(?:\/(\d+))?)?$/;

/** One element of a list: `*`, a value or a range, `*` and a range taking a step. */
function partValues(part: string, field: CronField): number[] {
  const text = part.toLowerCase();
  const values = everyValue(text, field) ?? valueOrRange(text, field);

  if (values === undefined) {
    throw unreadable(part, field);
  }

  return values;
}

function everyValue(text: string, field: CronField): number[] | undefined {
  const every = EVERY_VALUE.exec(text);

  return every === null ? undefined : stepping(field.min, field.max, every[1]);
}

function valueOrRange(text: string, field: CronField): number[] | undefined {
  const [, start, end, step] = VALUE_OR_RANGE.exec(text) ?? [];

  if (start === undefined) {
    return undefined;
  }

  return stepping(valueOf(start, field), valueOf(end ?? start, field), step);
}

function stepping(from: number, to: number, step: string | undefined): number[] | undefined {
  const stride = Number(step ?? 1);

  if (from > to || stride < 1) {
    return undefined;
  }

  return Array.from({ length: Math.floor((to - from) / stride) + 1 }, (_, index) => from + index * stride);
}

function valueOf(text: string, field: CronField): number {
  const named = field.names.indexOf(text);

  const value =
    named === -1 ? Number(/^\d+$/.test(text) ? text : Number.NaN) : named + (field.label === 'month' ? 1 : 0);

  if (Number.isNaN(value) || value < field.min || value > field.max) {
    throw unreadable(text, field);
  }

  return value;
}

function unreadable(text: string, field: CronField): InvalidJobScheduleError {
  const names = field.names.length === 0 ? '' : ` or a name (${field.names.join(', ')})`;

  return new InvalidJobScheduleError(
    `"${text}" is not a ${field.label} of a cron expression: write *, a value from ${field.min} to ${field.max}${names}, a range a-b, a step */n or a-b/n, or a list of those.`,
  );
}

/** A whole number followed by a unit: `'500ms'`, `'30s'`, `'15m'`, `'2h'`, `'1d'`. */
export type DurationText = `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`;

/**
 * Every so often, as milliseconds or a duration text. Occurrences are aligned on the Unix epoch
 * (`'15m'` falls at :00, :15, :30 and :45 UTC), so that every instance of an application names
 * the same instants and a restart does not shift them.
 */
export interface IntervalSchedule {
  readonly every: number | DurationText;
  readonly cron?: never;
  readonly timeZone?: never;
}

/**
 * The five standard fields (minute, hour, day of month, month, day of week), read on the
 * clocks of an IANA time zone. Default zone: `UTC`.
 */
export interface CronSchedule {
  readonly cron: string;
  readonly timeZone?: string;
  readonly every?: never;
}

export type JobSchedule = IntervalSchedule | CronSchedule;

export interface ParsedInterval {
  readonly kind: 'interval';
  readonly everyMs: number;
}

/** A cron expression as the sets of values it allows, each sorted. */
export interface ParsedCron {
  readonly kind: 'cron';
  readonly expression: string;
  readonly timeZone: string;
  readonly minutes: readonly number[];
  readonly hours: readonly number[];
  readonly daysOfMonth: readonly number[];
  readonly months: readonly number[];
  /** 0 is Sunday. */
  readonly daysOfWeek: readonly number[];
  /** False when the field starts with `*`. When both day fields are restricted, a day matching either one fits. */
  readonly dayOfMonthRestricted: boolean;
  readonly dayOfWeekRestricted: boolean;
  /**
   * True when the hour field starts with `*`: the job follows elapsed time and keeps its rhythm
   * when clocks are set back. Otherwise a local time that occurs twice runs once.
   */
  readonly everyHour: boolean;
}

export type ParsedJobSchedule = ParsedInterval | ParsedCron;

/** A schedule that cannot be read or would never fire. Raised where the schedule is written. */
export class InvalidJobScheduleError extends Error {
  readonly code = 'INVALID_JOB_SCHEDULE';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidJobScheduleError';
  }
}

/** The keys of a schedule as they are written next to other options, before they are known to be one schedule. */
export interface WrittenSchedule {
  readonly every?: number | DurationText;
  readonly cron?: string;
  readonly timeZone?: string;
}

/** `every 15m`, or `cron 0 7 * * 1-5 (Europe/Paris)`: the schedule as a diagnostic shows it. */
export function describeJobSchedule(schedule: JobSchedule): string {
  const parsed = parseJobSchedule(schedule);
  if (parsed.kind === 'cron') return `cron ${parsed.expression} (${parsed.timeZone})`;
  return `every ${typeof schedule.every === 'string' ? schedule.every : `${parsed.everyMs}ms`}`;
}

/** The schedule among the written keys, validated: an interval or a cron, never both, never neither. */
export function jobScheduleOf({ every, cron, timeZone }: WrittenSchedule): JobSchedule {
  const schedule: JobSchedule | undefined =
    cron === undefined ? (every === undefined ? undefined : { every }) : { cron, ...(timeZone === undefined ? {} : { timeZone }) };
  if (schedule === undefined || (cron !== undefined && every !== undefined) || (cron === undefined && timeZone !== undefined)) {
    throw new InvalidJobScheduleError('A schedule is either { every } or { cron, timeZone? }.');
  }
  parseJobSchedule(schedule);
  return schedule;
}

/** Validates a schedule and answers it in the form occurrences are computed from. */
export function parseJobSchedule(schedule: JobSchedule): ParsedJobSchedule {
  if (schedule.cron !== undefined) return parseCron(schedule.cron, schedule.timeZone ?? 'UTC');
  return { kind: 'interval', everyMs: parseDuration(schedule.every) };
}

const UNIT_MS: Readonly<Record<string, number>> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
const DURATION = /^(\d+)(ms|s|m|h|d)$/;

/** Milliseconds of a duration, refusing zero, a fraction and an unknown unit. */
export function parseDuration(duration: number | string): number {
  const ms = typeof duration === 'number' ? duration : durationTextMs(duration);
  if (!Number.isSafeInteger(ms) || ms <= 0) {
    throw new InvalidJobScheduleError(
      `"${duration}" is not a duration: write a positive whole number of milliseconds, or a text such as '30s', '15m', '2h', '1d'.`,
    );
  }
  return ms;
}

function durationTextMs(text: string): number {
  const [, amount, unit] = DURATION.exec(text.trim()) ?? [];
  return Number(amount ?? Number.NaN) * (UNIT_MS[unit ?? ''] ?? Number.NaN);
}

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

function parseCron(expression: string, timeZone: string): ParsedCron {
  const fields = expression.trim().split(/\s+/);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  if (fields.length !== 5 || minute === undefined || hour === undefined || dayOfMonth === undefined || month === undefined || dayOfWeek === undefined) {
    throw new InvalidJobScheduleError(
      `Cron "${expression}" has ${fields.length} field(s): five are expected (minute, hour, day of month, month, day of week).`,
    );
  }
  assertTimeZone(timeZone);
  return firing({
    kind: 'cron',
    expression: fields.join(' '),
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

function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new InvalidJobScheduleError(`"${timeZone}" is not a time zone this runtime knows: write an IANA name such as 'Europe/Paris'.`);
  }
}

const LONGEST_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Refuses the expression no date satisfies, such as the 31st of February. */
function firing(cron: ParsedCron): ParsedCron {
  if (!cron.dayOfMonthRestricted || cron.dayOfWeekRestricted) return cron;
  const earliestDay = cron.daysOfMonth[0] ?? 1;
  if (cron.months.some((month) => earliestDay <= (LONGEST_MONTH[month - 1] ?? 0))) return cron;
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
  if (values === undefined) throw unreadable(part, field);
  return values;
}

function everyValue(text: string, field: CronField): number[] | undefined {
  const every = EVERY_VALUE.exec(text);
  return every === null ? undefined : stepping(field.min, field.max, every[1]);
}

function valueOrRange(text: string, field: CronField): number[] | undefined {
  const [, start, end, step] = VALUE_OR_RANGE.exec(text) ?? [];
  if (start === undefined) return undefined;
  return stepping(valueOf(start, field), valueOf(end ?? start, field), step);
}

function stepping(from: number, to: number, step: string | undefined): number[] | undefined {
  const stride = Number(step ?? 1);
  if (from > to || stride < 1) return undefined;
  return Array.from({ length: Math.floor((to - from) / stride) + 1 }, (_, index) => from + index * stride);
}

function valueOf(text: string, field: CronField): number {
  const named = field.names.indexOf(text);
  const value = named === -1 ? Number(/^\d+$/.test(text) ? text : Number.NaN) : named + (field.label === 'month' ? 1 : 0);
  if (Number.isNaN(value) || value < field.min || value > field.max) throw unreadable(text, field);
  return value;
}

function unreadable(text: string, field: CronField): InvalidJobScheduleError {
  const names = field.names.length === 0 ? '' : ` or a name (${field.names.join(', ')})`;
  return new InvalidJobScheduleError(
    `"${text}" is not a ${field.label} of a cron expression: write *, a value from ${field.min} to ${field.max}${names}, a range a-b, a step */n or a-b/n, or a list of those.`,
  );
}

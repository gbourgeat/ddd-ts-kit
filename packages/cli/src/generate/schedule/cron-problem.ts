import type { CronField } from './cron-field';
import { cronFieldValues } from './cron-field-values';

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Minute, hour, day of month, month, day of week: the five standard fields, in order. */
const FIELDS: readonly CronField[] = [
  { label: 'minute', min: 0, max: 59, names: [] },
  { label: 'hour', min: 0, max: 23, names: [] },
  { label: 'day of month', min: 1, max: 31, names: [] },
  { label: 'month', min: 1, max: 12, names: MONTH_NAMES },
  { label: 'day of week', min: 0, max: 7, names: DAY_NAMES },
];

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

const LONGEST_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Why a text is not a cron expression a job can run on, or undefined. The same judgement as the kernel makes when the job is declared. */
export function cronProblem(expression: string): string | undefined {
  const written = expression.trim();
  const expanded = written.startsWith('@') ? SHORTHANDS.get(written.toLowerCase()) : written;

  if (expanded === undefined) {
    return `Cron "${written}" is not a shorthand a scheduled job runs on: write five fields or one of ${[...SHORTHANDS.keys()].join(', ')}.`;
  }

  const texts = expanded.split(/\s+/);

  if (texts.length !== FIELDS.length) {
    return `Cron "${expression}" has ${texts.length} field(s): five are expected (minute, hour, day of month, month, day of week).`;
  }

  const values = FIELDS.map((field, index) => cronFieldValues(texts[index] ?? '', field));
  const unreadable = values.indexOf(undefined);

  if (unreadable !== -1) {
    return unreadableField(texts[unreadable] ?? '', FIELDS[unreadable]);
  }

  return neverFires(texts, values)
    ? `Cron "${texts.join(' ')}" never fires: none of its months has such a day.`
    : undefined;
}

function unreadableField(text: string, field: CronField | undefined): string {
  const names = field === undefined || field.names.length === 0 ? '' : ` or a name (${field.names.join(', ')})`;

  return `"${text}" is not a ${field?.label ?? 'field'} of a cron expression: write *, a value from ${field?.min ?? 0} to ${field?.max ?? 0}${names}, a range a-b, a step */n or a-b/n, or a list of those.`;
}

/** The expression no date satisfies, such as the 31st of February: a day of month given alone, later than every month it names lasts. */
function neverFires(texts: readonly string[], values: readonly (number[] | undefined)[]): boolean {
  const [, , dayOfMonth = '', , dayOfWeek = ''] = texts;
  const [, , days, months] = values;

  if (dayOfMonth.startsWith('*') || !dayOfWeek.startsWith('*')) {
    return false;
  }

  return !(months ?? []).some((month) => ((days ?? [])[0] ?? 1) <= (LONGEST_MONTH[month - 1] ?? 0));
}

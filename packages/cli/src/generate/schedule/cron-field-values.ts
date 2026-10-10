import type { CronField } from './cron-field.js';

const EVERY_VALUE = /^\*(?:\/(\d+))?$/;
const VALUE_OR_RANGE = /^([a-z0-9]+)(?:-([a-z0-9]+)(?:\/(\d+))?)?$/;

/** The values a field of a cron expression names, sorted, or undefined when one of its parts cannot be read. */
export function cronFieldValues(text: string, field: CronField): number[] | undefined {
  const parts = text.split(',').map((part) => partValues(part.toLowerCase(), field));
  const values = parts.flatMap((part) => part ?? []);

  return parts.includes(undefined) ? undefined : [...new Set(values)].sort((left, right) => left - right);
}

/** One element of a list: `*`, a value or a range, `*` and a range taking a step. */
function partValues(part: string, field: CronField): number[] | undefined {
  const every = EVERY_VALUE.exec(part);

  if (every !== null) return stepping(field.min, field.max, every[1]);

  const [, start, end, step] = VALUE_OR_RANGE.exec(part) ?? [];
  const from = start === undefined ? undefined : valueOf(start, field);
  const to = from === undefined ? undefined : valueOf(end ?? start ?? '', field);

  return from === undefined || to === undefined ? undefined : stepping(from, to, step);
}

function stepping(from: number, to: number, step: string | undefined): number[] | undefined {
  const stride = Number(step ?? 1);

  if (from > to || stride < 1) return undefined;

  return Array.from({ length: Math.floor((to - from) / stride) + 1 }, (_, index) => from + index * stride);
}

function valueOf(text: string, field: CronField): number | undefined {
  const named = field.names.indexOf(text);
  const value = named === -1 ? Number(/^\d+$/.test(text) ? text : Number.NaN) : named + (field.label === 'month' ? 1 : 0);

  return Number.isNaN(value) || value < field.min || value > field.max ? undefined : value;
}

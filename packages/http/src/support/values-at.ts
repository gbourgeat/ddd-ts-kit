import { isRecord } from './is-record';

/**
 * The values found at a dotted path of a body: `id` of an object, `items.id` of each item of a
 * list. A list met on the way is walked through; a missing step gives nothing.
 */
export function valuesAt(body: unknown, path: string): unknown[] {
  return path.split('.').reduce<unknown[]>((found, step) => found.flatMap((value) => stepInto(value, step)), [body]);
}

function stepInto(value: unknown, step: string): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown) => stepInto(item, step));
  }

  if (!isRecord(value) || !(step in value)) {
    return [];
  }

  const next = value[step];

  return next === undefined ? [] : [next];
}

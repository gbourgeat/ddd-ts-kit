import { jsonAt } from './json-at.js';

/** The texts a JSON value lists under a path of keys: the items of an array, or the values of an object. */
export function stringsAt(value: unknown, ...keys: readonly string[]): string[] {
  const found = jsonAt(value, ...keys);

  const items: readonly unknown[] = Array.isArray(found)
    ? found
    : typeof found === 'object' && found !== null
      ? Object.values(found)
      : [];

  return items.filter((item): item is string => typeof item === 'string');
}

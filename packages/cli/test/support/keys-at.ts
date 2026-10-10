import { jsonAt } from './json-at.js';

/** The keys a JSON object holds under a path of keys, in the order they were written. */
export function keysAt(value: unknown, ...keys: readonly string[]): string[] {
  const found = jsonAt(value, ...keys);

  return typeof found === 'object' && found !== null ? Object.keys(found) : [];
}

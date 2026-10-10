import { jsonAt } from './json-at.js';

/** The texts a JSON object holds under a path of keys, by key: the scripts or the dependencies of a manifest. */
export function textsAt(value: unknown, ...keys: readonly string[]): Record<string, string> {
  const found = jsonAt(value, ...keys);
  const entries = typeof found === 'object' && found !== null ? Object.entries(found) : [];

  return Object.fromEntries(entries.filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

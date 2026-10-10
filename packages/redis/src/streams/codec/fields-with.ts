import type { Entry } from './entry.js';

/** The fields of an entry, flat, with `added` put last: where a field is repeated, the last one is read. */
export function fieldsWith(entry: Entry, added: Readonly<Record<string, string>>): string[] {
  const kept = [...entry.fields].filter(([name]) => !(name in added));

  return [...kept, ...Object.entries(added)].flat();
}

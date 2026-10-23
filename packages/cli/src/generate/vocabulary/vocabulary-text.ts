import { heldEntries } from './held-entries';
import type { VocabularyEntry } from './vocabulary-entry';

/**
 * The file of a closed vocabulary: an object `as const` of its values and the union type of the
 * same name, so that `AppointmentStatus.NoShow` is completed by the editor and a parameter typed
 * `AppointmentStatus` accepts nothing else. Given the text of the file, the values it misses are
 * added before the end of the object, and what it holds is kept as it is.
 */
export function vocabularyText(name: string, entries: readonly VocabularyEntry[], existing?: string): string {
  if (existing === undefined) {
    return [
      `export const ${name} = {`,
      ...entries.map(({ key, value }) => `  ${key}: '${value}',`),
      '} as const;',
      '',
      `export type ${name} = (typeof ${name})[keyof typeof ${name}];`,
      '',
    ].join('\n');
  }

  const held = new Set(heldEntries(existing).map(({ value }) => value));
  const missing = entries.filter(({ value }) => !held.has(value));
  const end = existing.indexOf('} as const;');

  if (missing.length === 0 || end === -1) {
    return existing;
  }

  const added = missing.map(({ key, value }) => `  ${key}: '${value}',\n`).join('');

  return `${existing.slice(0, end)}${added}${existing.slice(end)}`;
}

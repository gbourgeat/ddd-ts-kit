import type { VocabularyEntry } from './vocabulary-entry';

const DECLARED_VALUE = /^\s*([A-Za-z_$][\w$]*)\s*:\s*'([^']*)',?\s*$/gm;

/** The entries the file of a closed vocabulary holds, in their order: `NoShow: 'no-show',` one per line. */
export function heldEntries(text: string): VocabularyEntry[] {
  return [...text.matchAll(DECLARED_VALUE)].map(([, key = '', value = '']) => ({ key, value }));
}

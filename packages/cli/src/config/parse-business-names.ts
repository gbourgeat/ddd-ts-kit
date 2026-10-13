import type { BusinessNames } from './config.js';
import { isRecord } from './values/is-record.js';

/** Tolerant: an entry that is not a word is left out, and a `words` that is not a list keeps the defaults. */
export function parseBusinessNames(value: unknown): BusinessNames {
  const raw = isRecord(value) ? value : {};
  const words = raw['words'];

  return {
    words: Array.isArray(words) ? wordsOf(words) : undefined,
    allow: Array.isArray(raw['allow']) ? wordsOf(raw['allow']) : [],
  };
}

function wordsOf(entries: readonly unknown[]): string[] {
  return entries.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
}

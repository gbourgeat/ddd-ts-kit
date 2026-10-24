import type { PrivacyConfig } from './config';
import { isRecord } from './values/is-record';

/** Tolerant: an entry that is not a word is left out, and a list that is not one is empty. */
export function parsePrivacy(value: unknown): PrivacyConfig {
  const raw = isRecord(value) ? value : {};

  return { vocabulary: wordsOf(raw['vocabulary']), allow: wordsOf(raw['allow']) };
}

function wordsOf(entries: unknown): string[] {
  return Array.isArray(entries)
    ? entries.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    : [];
}
